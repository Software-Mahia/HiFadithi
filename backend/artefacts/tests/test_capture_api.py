import uuid
from urllib.parse import urlparse

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from artefacts.models import VIEW_KEYS, Artefact, Capture

pytestmark = pytest.mark.django_db

BODY = {
    "nmk_accession_no": "NMK-2026-001",
    "title": "Emedot",
    "community": "Turkana",
    "object_type": "Headdress",
    "materials": "Clay, ostrich feathers",
    "height_mm": 450,
}


@pytest.fixture(autouse=True)
def fake_setup(settings, monkeypatch):
    settings.AWS_S3_ENDPOINT_URL = "https://abcd.storage.supabase.co/storage/v1/s3"
    settings.AWS_S3_REGION_NAME = "eu-central-1"
    settings.AWS_ACCESS_KEY_ID = "test-key"
    settings.AWS_SECRET_ACCESS_KEY = "test-secret"
    # visible_artefacts() is still a stub (owner: A). Until it lands, every artefact is
    # visible in these tests. Replace this line with the real function and add a leak test.
    monkeypatch.setattr(
        "artefacts.selectors.visible_artefacts", lambda user: Artefact.objects.all()
    )

def client_for(role):
    user_model = get_user_model()
    user = user_model.objects.create_user(
        **{user_model.USERNAME_FIELD: f"{role}@example.com"}, password="pw-12345-x", role=role
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


def make_artefact(**kw):
    return Artefact.objects.create(nmk_accession_no=kw.pop("no", "NMK-1"), title="Emedot", **kw)


# ---- create ---------------------------------------------------------------

def test_researcher_creates_a_draft_artefact():
    response = client_for("researcher").post(
        reverse("artefact-create"), {**BODY, "collection_status": "in_collection"}, format="json"
    )
    assert response.status_code == 201
    artefact = Artefact.objects.get(pk=response.json()["id"])
    assert artefact.collection_status == "draft"  # the API cannot set it
    assert artefact.created_by is not None


def test_curator_cannot_create():
    response = client_for("curator").post(reverse("artefact-create"), BODY, format="json")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permission_denied"


def test_signed_out_user_cannot_create():
    response = APIClient().post(reverse("artefact-create"), BODY, format="json")
    assert response.status_code == 401


def test_duplicate_accession_number_is_a_400_not_a_crash():
    client = client_for("researcher")
    assert client.post(reverse("artefact-create"), BODY, format="json").status_code == 201
    response = client.post(reverse("artefact-create"), BODY, format="json")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid"


def test_height_must_be_above_zero():
    response = client_for("researcher").post(
        reverse("artefact-create"), {**BODY, "height_mm": 0}, format="json"
    )
    assert response.status_code == 400


# ---- start a capture --------------------------------------------------------

def test_start_capture_returns_four_upload_links():
    artefact = make_artefact()
    response = client_for("researcher").post(reverse("capture-start", args=[artefact.id]))
    assert response.status_code == 201
    body = response.json()
    capture = Capture.objects.get(pk=body["id"])
    assert capture.upload_complete is False
    assert body["expires_in"] == 3600
    assert set(body["upload_urls"]) == set(VIEW_KEYS)
    for view, link in body["upload_urls"].items():
        assert urlparse(link).path.endswith(f"/captures/{artefact.id}/{capture.id}/{view}.jpg")


def test_curator_cannot_start_a_capture():
    artefact = make_artefact()
    response = client_for("curator").post(reverse("capture-start", args=[artefact.id]))
    assert response.status_code == 403


def test_start_capture_for_an_unknown_artefact_is_a_404():
    response = client_for("researcher").post(reverse("capture-start", args=[uuid.uuid4()]))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# ---- complete a capture -----------------------------------------------------

def test_complete_fails_and_names_the_missing_photos(monkeypatch):
    artefact = make_artefact()
    capture = Capture.objects.create(artefact=artefact)
    monkeypatch.setattr(
        "artefacts.services.object_exists",
        lambda bucket, key: not key.endswith(("left.jpg", "right.jpg")),
    )
    response = client_for("researcher").post(reverse("capture-complete", args=[capture.id]))
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "missing_views"
    assert "left" in error["message"] and "right" in error["message"]
    capture.refresh_from_db()
    assert capture.upload_complete is False


def test_complete_succeeds_when_all_four_photos_exist(monkeypatch):
    artefact = make_artefact()
    capture = Capture.objects.create(artefact=artefact)
    monkeypatch.setattr("artefacts.services.object_exists", lambda bucket, key: True)
    response = client_for("researcher").post(reverse("capture-complete", args=[capture.id]))
    assert response.status_code == 200
    assert set(response.json()["views"]) == set(VIEW_KEYS)
    capture.refresh_from_db()
    assert capture.upload_complete is True
    assert capture.views["front"] == f"{artefact.id}/{capture.id}/front.jpg"


def test_complete_for_an_unknown_capture_is_a_404():
    response = client_for("researcher").post(reverse("capture-complete", args=[uuid.uuid4()]))
    assert response.status_code == 404