"""Everything in workflow that WRITES. Owner: D.

These are the seams other apps call (see docs/seams.md). Every status change goes
through transition_model(), inside allow_status_change().

Placeholder rules: transition_model() knows no move/caller checks yet, and it still
decides Artefact.collection_status (approved -> in the collection, withdrawn ->
withdrawn; anything else leaves the artefact status unchanged). The real permission
and move rules arrive later; the signature and the exceptions below stay the same.

- ValidationError: an unknown status now; an illegal move later (API 400).
- PermissionDenied: the caller may not make this move later (API 403).
- ValueError: a programming error such as an unsaved instance.
"""
from django.core.exceptions import ValidationError
from django.db import transaction

from artefacts.models import CollectionStatus

from .guard import allow_status_change
from .models import ModelVersion

# What an artefact's collection_status becomes when a version reaches a given
# review status. Anything not listed changes nothing on the artefact — a draft,
# processing or superseded version leaves the artefact exactly where it was.
_ARTEFACT_STATUS_BY_REVIEW_STATUS = {
    ModelVersion.Status.APPROVED: CollectionStatus.IN_COLLECTION,
    ModelVersion.Status.WITHDRAWN: CollectionStatus.WITHDRAWN,
}


def create_version(artefact, change_note, user):
    """Make version n+1 at Draft (artefact row locked). Returns the new ModelVersion.

    An Artefact pk is a UUID with a default, so an unsaved instance already carries a
    pk; _state.adding (plus the None check for None itself) is what says "unsaved".
    """
    if artefact is None or artefact._state.adding:
        raise ValueError("create_version() needs a saved Artefact.")

    with transaction.atomic():
        locked = type(artefact).objects.select_for_update().get(pk=artefact.pk)
        parent = ModelVersion.objects.filter(artefact=locked).order_by("-version").first()
        return ModelVersion.objects.create(
            artefact=locked,
            version=(parent.version + 1) if parent else 1,
            parent=parent,
            change_note=change_note or "",
            created_by=user,
        )


def transition_model(model_version, to_status, reason="", actor=None):
    """The ONLY way to change review_status, is_current and collection_status.

    Placeholder rules again: sets review_status, and when the new review status
    decides where the artefact stands in the collection it sets
    artefact.collection_status too (see _ARTEFACT_STATUS_BY_REVIEW_STATUS),
    always inside allow_status_change(). actor=None means the system (C's webhook
    and polling); reason and actor are accepted for the real rules.
    """
    if to_status not in ModelVersion.Status.values:
        raise ValidationError(f"Unknown review status: {to_status!r}.")
    if model_version.pk is None:
        raise ValueError("transition_model() needs a saved ModelVersion.")

    with allow_status_change():
        model_version.review_status = to_status
        model_version.save(update_fields=["review_status"])

        artefact_status = _ARTEFACT_STATUS_BY_REVIEW_STATUS.get(to_status)
        if artefact_status is not None:
            artefact = model_version.artefact
            artefact.collection_status = artefact_status
            artefact.save(update_fields=["collection_status"])
    return model_version


def check_tolerance(model_version, measurements, actor):
    """Compare width, depth and a landmark distance (height excluded); record a Verification.

    TODO (D).
    """
    raise NotImplementedError
