"""Public artefact endpoints: guests see a capped two-item preview, nothing more.

The published list is staff-only; detail and model are open to guests only for
preview artefacts. Every payload is an explicit whitelist.
"""

from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from artefacts.models import Artefact

pytestmark = pytest.mark.django_db

WHITELIST = {
    "id", "accession_number", "name", "community", "object_type",
    "description", "material", "dimensions", "date_or_period",
    "status", "status_label", "published_at",
    "cover_image_url", "has_model3d", "narration_ready",
    "images", "model3d", "narration",
}


@pytest.fixture
def published_artefact():
    artefact = Artefact.objects.create(
        nmk_accession_no="NMK/PUB/1",
        title="Public pot",
        community="Turkana",
        object_type="Headdress",
        description="Visible description",
        material="Clay",
        dimensions="30 cm",
        date_or_period="19th century",
        # staff-only content that must not appear in guest payloads
        provenance="Should not leak",
        donor="Should not leak",
        location="Should not leak",
        cultural_protocols="Should not leak",
        height_mm="300",
    )
    artefact.status = "published"
    artefact.save(update_fields=["status"])
    return artefact


def test_public_detail_returns_only_the_whitelist(published_artefact, settings):
    settings.PUBLIC_BASE_URL = "http://x"
    response = APIClient().get(reverse("public-artefact-detail", args=[published_artefact.id]))
    assert response.status_code == 200
    assert set(response.json()) == WHITELIST
    assert "Should not leak" not in response.content.decode()


def _staff(role="researcher"):
    user = get_user_model().objects.create_user(
        username=f"{role}@x", password="pw-12345-x", role=role
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


def _publish(n, **extra):
    artefact = Artefact.objects.create(
        nmk_accession_no=f"NMK/PUB/{n}", title=f"Pot {n}", material="Clay",
        provenance="Should not leak", donor="Should not leak", location="Should not leak",
        **extra,
    )
    Artefact.objects.filter(pk=artefact.pk).update(
        status="published", published_at=timezone.now() + timedelta(minutes=n)
    )
    return artefact


PREVIEW_FIELDS = {"id", "name", "material", "cover_image_url", "has_model3d"}


def test_guest_preview_returns_exactly_two_newest(settings):
    settings.PUBLIC_BASE_URL = "http://x"
    for n in range(1, 6):
        _publish(n)
    _publish(9, restricted=True)
    response = APIClient().get(reverse("public-artefact-preview"), {"limit": 100, "q": "Pot"})
    assert response.status_code == 200
    body = response.json()
    assert [item["name"] for item in body] == ["Pot 5", "Pot 4"]
    assert all(set(item) == PREVIEW_FIELDS for item in body)
    assert "Should not leak" not in response.content.decode()


def test_guest_preview_ignores_unpublished():
    Artefact.objects.create(nmk_accession_no="NMK/D/1", title="Draft pot")
    response = APIClient().get(reverse("public-artefact-preview"))
    assert response.status_code == 200
    assert response.json() == []


def test_guest_cannot_list_the_collection(published_artefact):
    response = APIClient().get(reverse("public-artefact-list"))
    assert response.status_code in (401, 403)
    assert "error" in response.json()
    assert "Public pot" not in response.content.decode()


def test_guest_cannot_open_an_artefact_outside_the_preview():
    hidden = _publish(1)
    _publish(2)
    _publish(3)
    detail = APIClient().get(reverse("public-artefact-detail", args=[hidden.id]))
    assert detail.status_code == 404
    assert detail.json()["error"]["code"] == "not_found"


def test_model_stream_serves_published_by_id_but_never_restricted_or_unpublished():
    """The 3D viewer cannot send a token, so the stream stays id-addressable for
    published artefacts (as the shipped app expects) but never leaks restricted
    or unpublished ones. No model file here, so a reachable record is 404
    "No 3D model yet" and an unreachable one is 404 "Artefact not found"."""
    published = _publish(1)
    _publish(2)
    _publish(3)
    restricted = _publish(4, restricted=True)
    draft = Artefact.objects.create(nmk_accession_no="NMK/D/9", title="Draft")
    client = APIClient()

    def message(artefact):
        response = client.get(reverse("public-artefact-model", args=[artefact.id]))
        assert response.status_code == 404
        return response.json()["error"]["message"]

    assert message(published) == "No 3D model yet."
    assert message(restricted) == "Artefact not found."
    assert message(draft) == "Artefact not found."


def test_staff_can_open_an_artefact_outside_the_preview(settings):
    settings.PUBLIC_BASE_URL = "http://x"
    hidden = _publish(1)
    _publish(2)
    _publish(3)
    response = _staff().get(reverse("public-artefact-detail", args=[hidden.id]))
    assert response.status_code == 200
    assert response.json()["name"] == "Pot 1"


def test_staff_list_hides_restricted_without_a_grant(settings):
    settings.PUBLIC_BASE_URL = "http://x"
    _publish(1)
    _publish(2, restricted=True)
    response = _staff("curator").get(reverse("public-artefact-list"))
    assert response.status_code == 200
    assert [item["name"] for item in response.json()] == ["Pot 1"]


def test_staff_list_returns_the_same_whitelist(published_artefact, settings):
    settings.PUBLIC_BASE_URL = "http://x"
    response = _staff().get(reverse("public-artefact-list"))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert set(body[0]) == WHITELIST
    assert body[0]["name"] == "Public pot"
    assert "Should not leak" not in response.content.decode()


def test_researcher_endpoints_keep_the_staff_fields(published_artefact):
    response = _staff().get(reverse("artefact-detail", args=[published_artefact.id]))
    assert response.status_code == 200
    body = response.json()
    assert body["cultural_protocols"] == "Should not leak"
    assert body["provenance"] == "Should not leak"
    assert body["donor"] == "Should not leak"
    assert body["location"] == "Should not leak"
