import uuid
from urllib.parse import urlparse

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from artefacts.models import VIEW_KEYS, Artefact, Capture
from workflow.services import create_version, transition_model

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
    return Artefact.objects.create(
        nmk_accession_no=kw.pop("no", "NMK-1"), title=kw.pop("title", "Emedot"), **kw
    )


# ---- create ---------------------------------------------------------------

def test_researcher_creates_a_draft_artefact():
    response = client_for("researcher").post(
        reverse("artefact-list"), {**BODY, "collection_status": "in_collection"}, format="json"
    )
    assert response.status_code == 201
    artefact = Artefact.objects.get(pk=response.json()["id"])
    assert artefact.collection_status == "draft"  # the API cannot set it
    assert artefact.created_by is not None


def test_curator_cannot_create():
    response = client_for("curator").post(reverse("artefact-list"), BODY, format="json")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "permission_denied"


def test_signed_out_user_cannot_create():
    response = APIClient().post(reverse("artefact-list"), BODY, format="json")
    assert response.status_code == 401


def test_duplicate_accession_number_is_a_400_not_a_crash():
    client = client_for("researcher")
    assert client.post(reverse("artefact-list"), BODY, format="json").status_code == 201
    response = client.post(reverse("artefact-list"), BODY, format="json")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid"


def test_height_must_be_above_zero():
    response = client_for("researcher").post(
        reverse("artefact-list"), {**BODY, "height_mm": 0}, format="json"
    )
    assert response.status_code == 400


# ---- get one artefact -------------------------------------------------------

def test_get_artefact_returns_fields_with_decimals_as_strings():
    artefact = make_artefact(height_mm="450.5", restricted=True)
    response = client_for("curator").get(reverse("artefact-detail", args=[artefact.id]))
    assert response.status_code == 200
    body = response.json()
    # The ported mobile contract extends the payload; the canonical fields remain.
    assert {
        "id", "nmk_accession_no", "title", "community", "object_type", "materials",
        "height_mm", "width_mm", "depth_mm", "extra_dimensions",
        "cultural_protocols", "restricted", "collection_status",
        "created_at", "updated_at",
        "accession_number", "name", "material", "status", "status_label",
    } <= set(body)
    assert body["height_mm"] == "450.5"
    assert body["width_mm"] is None
    assert body["collection_status"] == "draft"
    assert body["status"] == "draft"  # ported fast-flow status starts as draft too


def test_get_unknown_artefact_is_a_404():
    response = client_for("researcher").get(reverse("artefact-detail", args=[uuid.uuid4()]))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_get_artefact_the_user_may_not_see_is_a_404(monkeypatch):
    artefact = make_artefact()
    monkeypatch.setattr(
        "artefacts.selectors.visible_artefacts", lambda user: Artefact.objects.none()
    )
    response = client_for("researcher").get(reverse("artefact-detail", args=[artefact.id]))
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_signed_out_user_cannot_get_an_artefact():
    artefact = make_artefact()
    response = APIClient().get(reverse("artefact-detail", args=[artefact.id]))
    assert response.status_code == 401


# ---- list and search --------------------------------------------------------

def list_numbers(response):
    return [item["nmk_accession_no"] for item in response.json()["results"]]


def test_list_is_newest_first_and_paginated():
    for i in range(3):
        make_artefact(no=f"NMK-{i}")
    response = client_for("curator").get(reverse("artefact-list"))
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 3
    assert list_numbers(response) == ["NMK-2", "NMK-1", "NMK-0"]


def test_list_default_limit_is_20_and_max_is_100():
    Artefact.objects.bulk_create(
        Artefact(nmk_accession_no=f"NMK-{i}", title="Emedot") for i in range(105)
    )
    client = client_for("researcher")
    assert len(client.get(reverse("artefact-list")).json()["results"]) == 20
    assert len(client.get(reverse("artefact-list"), {"limit": 500}).json()["results"]) == 100
    page = client.get(reverse("artefact-list"), {"limit": 10, "offset": 100}).json()
    assert page["count"] == 105 and len(page["results"]) == 5


def test_list_returns_only_visible_artefacts(monkeypatch):
    make_artefact(no="NMK-SEEN")
    hidden = make_artefact(no="NMK-HIDDEN")
    monkeypatch.setattr(
        "artefacts.selectors.visible_artefacts",
        lambda user: Artefact.objects.exclude(pk=hidden.pk),
    )
    response = client_for("researcher").get(reverse("artefact-list"))
    assert list_numbers(response) == ["NMK-SEEN"]


@pytest.mark.parametrize(
    "field, value",
    [
        ("title", "Spear of the Maasai"),
        ("nmk_accession_no", "NMK-ZEBRA-9"),
        ("community", "Zebranese"),
        ("object_type", "Zebra mask"),
        ("materials", "dried zebra hide"),
    ],
)
def test_q_matches_each_searched_field_case_insensitively(field, value):
    make_artefact(no="NMK-OTHER")
    fields = {"no": "NMK-HIT"}
    if field == "nmk_accession_no":
        fields["no"] = value
    else:
        fields[field] = value
    hit = make_artefact(**fields)
    needle = value.split()[-1].upper()  # e.g. "MAASAI", "NMK-ZEBRA-9", "HIDE"
    response = client_for("researcher").get(reverse("artefact-list"), {"q": needle})
    assert list_numbers(response) == [hit.nmk_accession_no]


def test_q_with_no_match_returns_empty_page():
    make_artefact()
    response = client_for("researcher").get(reverse("artefact-list"), {"q": "nothing-like-this"})
    assert response.status_code == 200
    assert response.json()["results"] == []


def test_filter_by_community():
    make_artefact(no="NMK-T", community="Turkana")
    make_artefact(no="NMK-M", community="Maasai")
    response = client_for("curator").get(reverse("artefact-list"), {"community": "turkana"})
    assert list_numbers(response) == ["NMK-T"]


def test_filter_by_object_type():
    make_artefact(no="NMK-H", object_type="Headdress")
    make_artefact(no="NMK-S", object_type="Spear")
    response = client_for("curator").get(reverse("artefact-list"), {"object_type": "spear"})
    assert list_numbers(response) == ["NMK-S"]


def test_filter_by_status():
    make_artefact(no="NMK-D")
    in_collection = make_artefact(no="NMK-IC")
    # collection_status may change only through transition_model() (AGENTS.md rule 3).
    transition_model(create_version(in_collection, "First record", None), "approved")
    response = client_for("curator").get(reverse("artefact-list"), {"status": "in_collection"})
    assert list_numbers(response) == ["NMK-IC"]


def test_unknown_status_is_a_400_in_the_error_shape():
    response = client_for("curator").get(reverse("artefact-list"), {"status": "bogus"})
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "invalid"
    assert "status" in error["message"]


def test_signed_out_user_cannot_list():
    response = APIClient().get(reverse("artefact-list"))
    assert response.status_code == 401


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