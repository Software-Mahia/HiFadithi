"""The Job admin page shows the 3D model once there is one."""
import pytest
from django.urls import reverse

from accounts.models import User
from artefacts.models import VIEW_KEYS, Artefact, Capture
from pipeline.models import Job
from workflow.services import create_version

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client(client):
    user = User.objects.create_superuser(username="boss", password="a-long-password-1",
                                         email="b@x.org")
    client.force_login(user)
    return client


@pytest.fixture
def job():
    artefact = Artefact.objects.create(nmk_accession_no="NMK-E-001", title="Emedot headdress")
    views = {v: f"x/{v}.jpg" for v in VIEW_KEYS}
    capture = Capture.objects.create(artefact=artefact, views=views, upload_complete=True)
    version = create_version(artefact, "test", None)
    return Job.objects.create(model_version=version, capture=capture, engine="fake")


def test_job_page_without_a_model(admin_client, job):
    page = admin_client.get(reverse("admin:pipeline_job_change", args=[job.pk]))
    assert page.status_code == 200
    assert b"No model yet." in page.content


def test_job_page_shows_the_model_viewer(admin_client, job):
    version = job.model_version
    version.glb_path = f"{version.artefact_id}/v1/model.glb"
    version.bbox_width_mm, version.bbox_depth_mm, version.triangles = 200, 100, 12
    version.save()

    page = admin_client.get(reverse("admin:pipeline_job_change", args=[job.pk]))

    assert b"<model-viewer" in page.content
    assert version.glb_path.encode() in page.content
    assert b"200 mm wide x 100 mm deep, 12 triangles" in page.content


def test_job_list_page_loads(admin_client, job):
    assert admin_client.get(reverse("admin:pipeline_job_changelist")).status_code == 200
