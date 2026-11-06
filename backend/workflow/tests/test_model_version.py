"""Tests for the placeholder ModelVersion model and workflow services."""
import pytest
from django.core.exceptions import ValidationError

from accounts.models import User
from artefacts.models import Artefact, CollectionStatus
from workflow.guard import ProtectedFieldChanged
from workflow.models import ModelVersion
from workflow.services import create_version, transition_model


@pytest.fixture
def user(db):
    return User.objects.create_user(username="researcher", password="x-long-password-1")


@pytest.fixture
def artefact(db):
    return Artefact.objects.create(nmk_accession_no="NMK-2026-0001", title="Calabash")


def test_create_version_numbers_per_artefact_and_starts_at_draft(user, artefact):
    other_artefact = Artefact.objects.create(
        nmk_accession_no="NMK-2026-0002", title="Guardian figure"
    )

    first = create_version(artefact, "First record", user)
    second = create_version(artefact, "Re-capture", user)
    other = create_version(other_artefact, "First record", user)

    assert first.version == 1
    assert first.review_status == ModelVersion.Status.DRAFT
    assert first.is_current is False
    assert first.parent is None
    assert first.created_by == user

    assert second.version == 2
    assert second.parent == first
    assert other.version == 1


def test_create_version_needs_a_saved_artefact(user):
    with pytest.raises(ValueError):
        create_version(Artefact(), "Not saved", user)


def test_transition_model_sets_the_status(user, artefact):
    version = create_version(artefact, "First record", user)

    returned = transition_model(
        version,
        ModelVersion.Status.NEEDS_VERIFICATION,
        reason="Meshy finished",
    )

    assert returned is version
    version.refresh_from_db()
    assert version.review_status == ModelVersion.Status.NEEDS_VERIFICATION
    assert version.is_current is False


def test_transition_model_rejects_an_unknown_status(user, artefact):
    version = create_version(artefact, "First record", user)

    with pytest.raises(ValidationError):
        transition_model(version, "not_a_status")


def test_transition_model_needs_a_saved_version(artefact):
    with pytest.raises(ValueError):
        transition_model(ModelVersion(artefact=artefact), ModelVersion.Status.PROCESSING)


def test_protected_fields_cannot_be_changed_directly(user, artefact):
    version = create_version(artefact, "First record", user)

    version.review_status = ModelVersion.Status.APPROVED
    with pytest.raises(ProtectedFieldChanged):
        version.save()

    version.is_current = True
    with pytest.raises(ProtectedFieldChanged):
        version.save()


def test_new_version_must_start_with_protected_defaults(artefact):
    with pytest.raises(ProtectedFieldChanged):
        ModelVersion.objects.create(
            artefact=artefact,
            version=1,
            review_status=ModelVersion.Status.APPROVED,
        )


def test_transition_model_moves_the_artefact_into_the_collection_on_approval(
    user, artefact
):
    version = create_version(artefact, "First record", user)

    transition_model(version, ModelVersion.Status.APPROVED)

    artefact.refresh_from_db()
    assert artefact.collection_status == CollectionStatus.IN_COLLECTION


def test_transition_model_withdraws_the_artefact(user, artefact):
    version = create_version(artefact, "First record", user)
    transition_model(version, ModelVersion.Status.APPROVED)

    transition_model(version, ModelVersion.Status.WITHDRAWN)

    artefact.refresh_from_db()
    assert artefact.collection_status == CollectionStatus.WITHDRAWN


def test_transition_model_leaves_the_artefact_untouched_for_other_statuses(
    user, artefact
):
    version = create_version(artefact, "First record", user)

    transition_model(version, ModelVersion.Status.NEEDS_VERIFICATION)

    artefact.refresh_from_db()
    assert artefact.collection_status == CollectionStatus.DRAFT
