"""Finishing jobs: refresh_job(), the Meshy webhook, the poll endpoint and the job page.

The engine is a FakeEngine (or a scripted one); the model download goes to a fake HTTP
server and a temporary folder. No network, no credits.
"""
from datetime import timedelta
from functools import partial

import httpx
import pytest
from django.core.files.storage import FileSystemStorage
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from artefacts.models import VIEW_KEYS, Artefact, Capture
from pipeline import model_files, services
from pipeline.engines.base import TaskStatus
from pipeline.engines.fake import FakeEngine
from pipeline.engines.meshy import MeshyError
from pipeline.models import Job
from pipeline.services import poll_jobs, refresh_job, start_job
from workflow.models import ModelVersion

from .glb_factory import box_gltf, make_glb

pytestmark = pytest.mark.django_db
TOKEN = "test-webhook-token"
GLB = make_glb(box_gltf(size=(0.2, 0.3, 0.1), triangles=12))


FAKE_GLB = "https://samples.example.org/demo.glb"


@pytest.fixture(autouse=True)
def setup(monkeypatch, tmp_path, settings):
    settings.ENGINE = "fake"
    settings.FAKE_ENGINE_GLB_URL = FAKE_GLB
    settings.MESHY_WEBHOOK_TOKEN = TOKEN
    monkeypatch.setattr("pipeline.selectors.visible_artefacts", lambda user: Artefact.objects.all())
    # Model downloads come from a fake server; files land in a temporary folder.
    storage = FileSystemStorage(location=tmp_path)
    client = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=GLB)))
    monkeypatch.setattr(
        services, "copy_model", partial(model_files.copy_model, client=client, storage=storage)
    )
    return storage


def use_engine(monkeypatch, engine):
    monkeypatch.setattr(services, "get_engine", lambda name=None: engine)


@pytest.fixture
def researcher():
    return User.objects.create_user(username="r", password="a-long-password-1", role="researcher")


@pytest.fixture
def job(researcher):
    artefact = Artefact.objects.create(nmk_accession_no="NMK-E-001", title="Emedot headdress")
    views = {v: f"{artefact.id}/cap/{v}.jpg" for v in VIEW_KEYS}
    capture = Capture.objects.create(artefact=artefact, views=views, upload_complete=True)
    return start_job(capture=capture, user=researcher)


class Scripted:
    """An engine that answers get_status() with whatever the test sets."""

    def __init__(self, task):
        self.task, self.calls = task, 0

    def get_status(self, task_id):
        self.calls += 1
        if isinstance(self.task, Exception):
            raise self.task
        return self.task


# --- refresh_job ------------------------------------------------------------------------------

def test_a_finished_task_copies_the_model_and_moves_the_version_to_verification(
    job, monkeypatch, setup
):
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))

    job = refresh_job(job)

    assert (job.status, job.progress) == (Job.Status.SUCCEEDED, 100)
    assert job.finished_at is not None
    version = ModelVersion.objects.get(pk=job.model_version_id)
    assert version.review_status == ModelVersion.Status.NEEDS_VERIFICATION
    assert version.glb_path == f"{version.artefact_id}/v1/model.glb"
    assert (version.bbox_width_mm, version.bbox_depth_mm, version.triangles) == (200, 100, 12)
    assert setup.exists(version.glb_path)


def test_a_running_task_records_progress_but_never_goes_backwards(job, monkeypatch):
    use_engine(monkeypatch, Scripted(TaskStatus(status="IN_PROGRESS", progress=60)))
    assert refresh_job(job).progress == 60

    use_engine(monkeypatch, Scripted(TaskStatus(status="IN_PROGRESS", progress=20)))  # late reply
    job = refresh_job(job)
    assert (job.status, job.progress) == (Job.Status.RUNNING, 60)


def test_a_failed_task_fails_the_job_and_version_with_meshys_reason(job, monkeypatch):
    failed = TaskStatus(status="FAILED", error="Bad photos", credits_used=0)
    use_engine(monkeypatch, Scripted(failed))

    job = refresh_job(job)

    assert (job.status, job.error) == (Job.Status.FAILED, "Bad photos")
    assert job.model_version.review_status == ModelVersion.Status.FAILED


def test_success_without_a_model_link_is_a_failure(job, monkeypatch):
    use_engine(monkeypatch, Scripted(TaskStatus(status="SUCCEEDED", glb_url=None)))
    assert "without a model file" in refresh_job(job).error


def test_a_broken_model_file_is_a_failure(job, monkeypatch, setup):
    bad = httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"x")))
    monkeypatch.setattr(
        services, "copy_model", partial(model_files.copy_model, client=bad, storage=setup)
    )
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))

    job = refresh_job(job)

    assert job.status == Job.Status.FAILED
    assert "Not a GLB" in job.error


def test_a_finished_job_is_left_alone_by_repeats(job, monkeypatch):
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))
    refresh_job(job)

    engine = Scripted(TaskStatus(status="FAILED", error="late"))
    use_engine(monkeypatch, engine)
    job = refresh_job(Job.objects.get(pk=job.pk))

    assert job.status == Job.Status.SUCCEEDED
    assert engine.calls == 0  # not even asked


# --- webhook ----------------------------------------------------------------------------------

def webhook(body, token=TOKEN):
    return APIClient().post(f"/api/webhooks/meshy/{token}/", body, format="json")


def test_webhook_finishes_the_job_using_meshys_own_status(job, monkeypatch):
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))

    # The body claims FAILED, but we ask the engine, which says SUCCEEDED.
    response = webhook({"id": job.task_id, "status": "FAILED"})

    assert response.status_code == 200
    assert response.data == {"status": "succeeded"}
    assert Job.objects.get(pk=job.pk).status == Job.Status.SUCCEEDED


def test_webhook_twice_is_harmless(job, monkeypatch):
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))
    webhook({"id": job.task_id})
    second = webhook({"id": job.task_id})
    assert second.status_code == 200
    assert Job.objects.get(pk=job.pk).status == Job.Status.SUCCEEDED


def test_webhook_for_a_task_we_dont_know_is_acknowledged_and_ignored():
    response = webhook({"id": "someone-elses-task"})
    assert (response.status_code, response.data) == (200, {"status": "ignored"})


def test_webhook_with_a_wrong_token_is_404(job):
    assert webhook({"id": job.task_id}, token="guess").status_code == 404


@override_settings(MESHY_WEBHOOK_TOKEN="")
def test_webhook_is_off_when_no_token_is_set(job):
    assert webhook({"id": job.task_id}, token="anything").status_code == 404


def test_webhook_asks_meshy_to_retry_when_meshy_is_down(job, monkeypatch):
    use_engine(monkeypatch, Scripted(MeshyError("Meshy unavailable")))
    assert webhook({"id": job.task_id}).status_code == 503
    assert Job.objects.get(pk=job.pk).status == Job.Status.RUNNING


# --- poll -------------------------------------------------------------------------------------

def test_poll_finishes_ready_jobs(job, monkeypatch):
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))
    response = APIClient().get(f"/api/jobs/poll/{TOKEN}/")
    assert response.status_code == 200
    assert response.data == {"checked": 1, "succeeded": 1, "failed": 0, "errors": 0}


@pytest.mark.parametrize("accept", ["text/html", "*/*", "application/xml", ""])
def test_poll_runs_and_answers_json_whatever_the_accept_header(job, monkeypatch, accept):
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))
    response = APIClient().get(f"/api/jobs/poll/{TOKEN}/", HTTP_ACCEPT=accept)
    assert response.status_code == 200
    assert response["Content-Type"].startswith("application/json")
    assert response.json() == {"checked": 1, "succeeded": 1, "failed": 0, "errors": 0}


def test_webhook_runs_whatever_the_accept_header(job, monkeypatch):
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))
    response = APIClient().post(
        f"/api/webhooks/meshy/{TOKEN}/", {"id": job.task_id}, format="json", HTTP_ACCEPT="text/html"
    )
    assert response.status_code == 200
    assert response.json() == {"status": "succeeded"}


def test_poll_needs_the_token(job):
    assert APIClient().get("/api/jobs/poll/wrong/").status_code == 404


def test_poll_fails_jobs_stuck_for_over_30_minutes(job, monkeypatch):
    engine = Scripted(TaskStatus(status="IN_PROGRESS", progress=10))
    use_engine(monkeypatch, engine)
    Job.objects.filter(pk=job.pk).update(created_at=timezone.now() - timedelta(minutes=31))

    counts = poll_jobs()

    assert counts["failed"] == 1 and engine.calls == 0
    assert "30 minutes" in Job.objects.get(pk=job.pk).error


def test_poll_fails_jobs_that_never_got_a_task_id(job):
    Job.objects.filter(pk=job.pk).update(
        status=Job.Status.QUEUED, task_id=None, created_at=timezone.now() - timedelta(minutes=6)
    )
    assert poll_jobs()["failed"] == 1
    assert Job.objects.get(pk=job.pk).status == Job.Status.FAILED


def test_poll_keeps_going_when_meshy_is_down(job, monkeypatch):
    use_engine(monkeypatch, Scripted(MeshyError("Meshy unavailable")))
    assert poll_jobs()["errors"] == 1
    assert Job.objects.get(pk=job.pk).status == Job.Status.RUNNING


# --- job page ---------------------------------------------------------------------------------

def test_the_job_page_moves_a_waiting_job_forward(job, researcher, monkeypatch):
    use_engine(monkeypatch, FakeEngine(seconds=0, glb_url=FAKE_GLB))
    Job.objects.filter(pk=job.pk).update(updated_at=timezone.now() - timedelta(seconds=30))
    client = APIClient()
    client.force_authenticate(researcher)

    body = client.get(f"/api/jobs/{job.id}/").data

    assert (body["status"], body["review_status"]) == ("succeeded", "needs_verification")


def test_the_job_page_does_not_ask_the_engine_on_every_request(job, researcher, monkeypatch):
    engine = Scripted(TaskStatus(status="IN_PROGRESS", progress=10))
    use_engine(monkeypatch, engine)
    client = APIClient()
    client.force_authenticate(researcher)

    client.get(f"/api/jobs/{job.id}/")  # job was just updated by start_job

    assert engine.calls == 0


# --- only download from the engine's own host -------------------------------------------------

@pytest.mark.parametrize(
    "url, engine, allowed",
    [
        ("https://assets.meshy.ai/abc/model.glb?Expires=1", "meshy", True),
        ("https://meshy.ai/model.glb", "meshy", True),
        ("http://assets.meshy.ai/model.glb", "meshy", False),        # not https
        ("https://assets.meshy.ai.evil.org/model.glb", "meshy", False),
        ("https://evilmeshy.ai/model.glb", "meshy", False),
        ("https://169.254.169.254/latest/meta-data", "meshy", False),
        (FAKE_GLB, "fake", True),
        ("https://assets.meshy.ai/model.glb", "fake", False),
        (None, "meshy", False),
    ],
)
def test_model_url_allowed(url, engine, allowed):
    assert services.model_url_allowed(url, engine) is allowed


def test_a_model_link_from_another_host_fails_the_job_without_downloading(job, monkeypatch):
    def must_not_download(*args, **kwargs):
        raise AssertionError("copy_model should not be called")

    monkeypatch.setattr(services, "copy_model", must_not_download)
    use_engine(monkeypatch, Scripted(TaskStatus(status="SUCCEEDED", glb_url="https://evil.org/x.glb")))

    job = refresh_job(job)

    assert job.status == Job.Status.FAILED
    assert "not from the 3D service" in job.error
