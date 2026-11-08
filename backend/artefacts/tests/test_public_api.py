"""The guest-gallery endpoints expose an explicit whitelist only."""

import pytest
from django.urls import reverse
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


def test_public_list_returns_the_same_whitelist(published_artefact, settings):
    settings.PUBLIC_BASE_URL = "http://x"
    response = APIClient().get(reverse("public-artefact-list"))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert set(body[0]) == WHITELIST
    assert body[0]["name"] == "Public pot"
    assert "Should not leak" not in response.content.decode()


def test_researcher_endpoints_keep_the_staff_fields(published_artefact):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(
        username="r@x", password="pw-12345-x", role="researcher"
    )
    client = APIClient()
    client.force_authenticate(user)
    response = client.get(reverse("artefact-detail", args=[published_artefact.id]))
    assert response.status_code == 200
    body = response.json()
    assert body["cultural_protocols"] == "Should not leak"
    assert body["provenance"] == "Should not leak"
    assert body["donor"] == "Should not leak"
    assert body["location"] == "Should not leak"
