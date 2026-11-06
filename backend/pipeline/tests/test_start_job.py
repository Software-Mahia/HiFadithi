"""start_job() and the /api/jobs/ endpoints, with the FakeEngine and a fake Meshy."""
import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from accounts.models import User
from artefacts.models import VIEW_KEYS, Artefact, Capture
from pipeline import services
from pipeline.engines.meshy import MeshyError
from pipeline.models import Job
from pipeline.services import (
    CaptureIncomplete,
    CreditLimitReached,
    EngineUnavailable,
    JobAlreadyRunning,
    start_job,
)
from workflow.models import ModelVersion

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def everything_visible(monkeypatch):
    # access.selectors.visible_artefacts is still a stub (A). Replace it until it lands.
    monkeypatch.setattr("pipeline.selectors.visible_artefacts", lambda user: Artefact.objects.all())


@pytest.fixture
def researcher():
    return User.objects.create_user(username="wanjiru", password="a-long-password-1",
                                    role="researcher")


@pytest.fixture
def artefact():
    return Artefact.objects.create(nmk_accession_no="NMK-E-001", title="Emedot headdress")


def make_capture(artefact, complete=True):
    views = {v: f"{artefact.id}/cap/{v}.jpg" for v in VIEW_KEYS} if complete else {}
    return Capture.objects.create(artefact=artefact, views=views, upload_complete=complete)


class FakeMeshy:
    """Stands in for MeshyEngine: records the links, returns a task id or raises."""

    def __init__(self, error=None):
        self.error, self.submitted = error, None

    def submit(self, urls):
        if self.error:
            raise self.error
        self.submitted = urls
        return "meshy-task-1"


# --- the service -----------------------------------------------------------------------------

@override_settings(ENGINE="fake")
def test_start_job_makes_a_processing_version_and_a_running_job(artefact, researcher):
    capture = make_capture(artefact)

    job = start_job(capture=capture, user=researcher)

    assert job.status == Job.Status.RUNNING
    assert job.task_id.startswith("fake-ok-")
    assert job.engine == "fake"
    assert job.started_by == researcher
    version = job.model_version
    assert (version.artefact, version.version) == (artefact, 1)
    assert version.review_status == ModelVersion.Status.PROCESSING


@override_settings(ENGINE="meshy", MESHY_AI_MODEL="meshy-6-lite")
def test_photos_are_sent_front_back_left_right_with_fresh_6_hour_links(
    artefact, researcher, monkeypatch
):
    fake = FakeMeshy()
    monkeypatch.setattr(services, "get_engine", lambda: fake)
    signed = []

    def fake_signed(bucket, path, expires_in):
        signed.append((bucket, path, expires_in))
        return f"https://signed/{path}"

    monkeypatch.setattr(services, "signed_download_url", fake_signed)

    job = start_job(capture=make_capture(artefact), user=researcher)

    assert [p.rsplit("/", 1)[1] for p in fake.submitted] == [f"{v}.jpg" for v in VIEW_KEYS]
    assert all(b == "captures" and e == 6 * 3600 for b, _, e in signed)
    assert (job.task_id, job.ai_model) == ("meshy-task-1", "meshy-6-lite")


def test_an_incomplete_capture_is_refused(artefact, researcher):
    with pytest.raises(CaptureIncomplete):
        start_job(capture=make_capture(artefact, complete=False), user=researcher)
    assert not Job.objects.exists()
    assert not ModelVersion.objects.exists()


@override_settings(ENGINE="fake")
def test_only_one_active_job_per_artefact(artefact, researcher):
    capture = make_capture(artefact)
    start_job(capture=capture, user=researcher)
    with pytest.raises(JobAlreadyRunning):
        start_job(capture=capture, user=researcher)
    assert Job.objects.count() == 1


@override_settings(ENGINE="fake")
def test_a_new_job_can_start_after_the_last_one_failed(artefact, researcher):
    capture = make_capture(artefact)
    first = start_job(capture=capture, user=researcher)
    services.mark_failed(first, "Meshy said no")

    second = start_job(capture=capture, user=researcher)

    assert second.model_version.version == 2
    first.model_version.refresh_from_db()
    assert first.model_version.review_status == ModelVersion.Status.FAILED


@override_settings(ENGINE="meshy")
def test_when_meshy_refuses_the_job_and_version_are_kept_as_failed(
    artefact, researcher, monkeypatch
):
    monkeypatch.setattr(services, "get_engine", lambda: FakeMeshy(MeshyError("Bad image")))
    monkeypatch.setattr(services, "signed_download_url", lambda b, p, expires_in: "https://s/x")

    with pytest.raises(EngineUnavailable, match="Bad image"):
        start_job(capture=make_capture(artefact), user=researcher)

    job = Job.objects.get()
    assert job.status == Job.Status.FAILED
    assert job.error == "Bad image"
    assert job.finished_at is not None
    assert job.model_version.review_status == ModelVersion.Status.FAILED


@override_settings(ENGINE="meshy", MESHY_AI_MODEL="meshy-7.1", MESHY_MONTHLY_CREDIT_LIMIT=60)
def test_the_monthly_credit_limit_is_checked_before_spending(researcher, monkeypatch):
    monkeypatch.setattr(services, "get_engine", lambda: FakeMeshy())
    monkeypatch.setattr(services, "signed_download_url", lambda b, p, expires_in: "https://s/x")

    for n in range(2):  # 2 x 30 credits fills the limit of 60
        a = Artefact.objects.create(nmk_accession_no=f"NMK-{n}", title="Object")
        job = start_job(capture=make_capture(a), user=researcher)
        Job.objects.filter(pk=job.pk).update(task_id=f"t{n}")

    third = Artefact.objects.create(nmk_accession_no="NMK-3", title="Object")
    with pytest.raises(CreditLimitReached):
        start_job(capture=make_capture(third), user=researcher)


# --- the API ---------------------------------------------------------------------------------

@pytest.fixture
def api(researcher):
    client = APIClient()
    client.force_authenticate(researcher)
    return client


@override_settings(ENGINE="fake")
def test_post_jobs_starts_a_job_and_get_shows_it(api, artefact):
    capture = make_capture(artefact)

    created = api.post("/api/jobs/", {"capture_id": str(capture.id)}, format="json")

    assert created.status_code == 201, created.data
    body = created.data
    assert body["status"] == "running"
    assert body["review_status"] == "processing"
    assert body["version"] == 1
    assert "task_id" not in body  # internal

    shown = api.get(f"/api/jobs/{body['id']}/")
    assert shown.status_code == 200
    assert shown.data["id"] == body["id"]


def test_post_jobs_with_an_incomplete_capture_gives_our_error_shape(api, artefact):
    capture = make_capture(artefact, complete=False)
    response = api.post("/api/jobs/", {"capture_id": str(capture.id)}, format="json")
    assert response.status_code == 400
    assert response.data["error"]["code"] == "capture_incomplete"


def test_unknown_capture_and_job_are_404(api):
    missing = "00000000-0000-0000-0000-000000000000"
    assert api.post("/api/jobs/", {"capture_id": missing}, format="json").status_code == 404
    assert api.get(f"/api/jobs/{missing}/").status_code == 404


def test_only_researchers_can_start_jobs(artefact):
    curator = User.objects.create_user(username="curator", password="a-long-password-1",
                                       role="curator")
    client = APIClient()
    client.force_authenticate(curator)
    capture = make_capture(artefact)
    response = client.post("/api/jobs/", {"capture_id": str(capture.id)}, format="json")
    assert response.status_code == 403


def test_signed_out_users_are_refused(artefact):
    capture = make_capture(artefact)
    response = APIClient().post("/api/jobs/", {"capture_id": str(capture.id)}, format="json")
    assert response.status_code == 401
