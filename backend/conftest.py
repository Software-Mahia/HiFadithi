import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import User
from artefacts.models import Artefact, ArtefactImage, ArtefactStatus, ImageSlot, Model3D


@pytest.fixture
def researcher(db):
    return User.objects.create_user(
        username="researcher@example.com",
        email="researcher@example.com",
        password="test-pass-123",
        role=User.Role.RESEARCHER,
    )


@pytest.fixture
def other_researcher(db):
    return User.objects.create_user(
        username="other@example.com",
        email="other@example.com",
        password="test-pass-123",
        role=User.Role.RESEARCHER,
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin@example.com",
        email="admin@example.com",
        password="test-pass-123",
        role=User.Role.ADMIN,
        is_superuser=True,
    )


def _login(client, user, password="test-pass-123"):
    response = client.post(
        reverse("token"), {"username": user.username, "password": password}, format="json"
    )
    assert response.status_code == 200, response.content
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.json()['access']}")
    return client


@pytest.fixture
def auth_client(researcher):
    return _login(APIClient(), researcher)


@pytest.fixture
def other_client(other_researcher):
    return _login(APIClient(), other_researcher)


@pytest.fixture
def admin_client(admin_user):
    return _login(APIClient(), admin_user)


@pytest.fixture
def artefact(db, researcher):
    return Artefact.objects.create(
        nmk_accession_no="NMK/TEST/001",
        title="Test pot",
        description="A test artefact",
        material="Clay",
        dimensions="30 cm",
        height_mm="300",
        width_mm="250",
        created_by=researcher,
    )


@pytest.fixture
def ready_artefact(artefact):
    for slot in ImageSlot.values:
        ArtefactImage.objects.create(
            artefact=artefact,
            slot=slot,
            storage_path=f"{artefact.id}/{slot}.jpg",
            content_type="image/jpeg",
        )
    Model3D.objects.create(artefact=artefact, glb_path=f"{artefact.id}/model.glb")
    artefact.status = ArtefactStatus.READY
    artefact.save(update_fields=["status"])
    return artefact
