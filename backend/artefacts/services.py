"""Everything in artefacts that WRITES. Owner: B.

Artefact, Capture, Hotspot, search; copy_hotspots() after day 6; seed_demo command.
"""
from rest_framework.exceptions import APIException

from core.storage import CAPTURES_BUCKET, object_exists, signed_upload_url

from .models import VIEW_KEYS, Capture

UPLOAD_LINK_SECONDS = 3600


class MissingViews(APIException):
    """Shows up in the API as {"error": {"code": "missing_views", ...}} with HTTP 400."""

    status_code = 400
    default_code = "missing_views"
    default_detail = "Some photos are missing."


def photo_key(capture, view):
    """Where a photo lives INSIDE the captures bucket (the bucket name is not part of it)."""
    return f"{capture.artefact_id}/{capture.id}/{view}.jpg"


def start_capture(*, artefact, user):
    """Create an empty capture and one upload link per view."""
    capture = Capture.objects.create(artefact=artefact, captured_by=user)
    upload_urls = {
        view: signed_upload_url(
            CAPTURES_BUCKET,
            photo_key(capture, view),
            expires_in=UPLOAD_LINK_SECONDS,
            content_type="image/jpeg",
        )
        for view in VIEW_KEYS
    }
    return capture, upload_urls


def complete_capture(*, capture):
    """Mark a capture complete once all four photos are really in storage."""
    keys = {view: photo_key(capture, view) for view in VIEW_KEYS}
    missing = [view for view, key in keys.items() if not object_exists(CAPTURES_BUCKET, key)]
    if missing:
        raise MissingViews(f"Missing: {', '.join(missing)}")
    capture.views = keys
    capture.upload_complete = True
    capture.save(update_fields=["views", "upload_complete"])
    return capture


# --- ported from the hifadithi MVP (mobile app pipeline / fast flow) ---------

from django.db import transaction  # noqa: E402
from django.utils import timezone  # noqa: E402
from rest_framework import status  # noqa: E402
from rest_framework.exceptions import APIException  # noqa: E402

from core import storage  # noqa: E402
from core.storage import MODELS_BUCKET, NARRATION_BUCKET  # noqa: E402

from .models import (  # noqa: E402
    Artefact,
    ArtefactImage,
    ArtefactStatus,
    ImageSlot,
    Model3D,
)

SLOT_VALUES = set(ImageSlot.values)


class InvalidTransition(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "invalid_transition"
    default_detail = "That status change is not allowed."


class ImageRequired(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "images_required"
    default_detail = "Add all four photos (front, back, left and right) first."


class HeightRequired(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "height_required"
    default_detail = "Add the artefact height before generating a model."


def create_artefact(*, actor, **data):
    return Artefact.objects.create(created_by=actor, **data)


def update_artefact(artefact, **data):
    for field, value in data.items():
        setattr(artefact, field, value)
    artefact.save()
    return artefact


def set_status(artefact, to_status):
    """Only used by services and pipeline tasks, never by a serializer."""
    allowed = {
        ArtefactStatus.DRAFT: {ArtefactStatus.PROCESSING},
        ArtefactStatus.PROCESSING: {ArtefactStatus.READY, ArtefactStatus.FAILED},
        ArtefactStatus.READY: {ArtefactStatus.PUBLISHED, ArtefactStatus.PROCESSING},
        ArtefactStatus.FAILED: {ArtefactStatus.PROCESSING},
        ArtefactStatus.PUBLISHED: {ArtefactStatus.READY, ArtefactStatus.PROCESSING},
    }
    if to_status not in allowed.get(artefact.status, set()):
        raise InvalidTransition(f"Cannot move artefact from {artefact.status} to {to_status}.")
    artefact.status = to_status
    fields = ["status", "updated_at"]
    if to_status == ArtefactStatus.PUBLISHED:
        artefact.published_at = timezone.now()
        fields.append("published_at")
    elif to_status != ArtefactStatus.PUBLISHED and artefact.published_at:
        artefact.published_at = None
        fields.append("published_at")
    artefact.save(update_fields=fields)
    return artefact


def mark_processing(artefact):
    if artefact.status == ArtefactStatus.PROCESSING:
        return artefact
    return set_status(artefact, ArtefactStatus.PROCESSING)


def mark_ready(artefact):
    if artefact.status == ArtefactStatus.READY:
        return artefact
    return set_status(artefact, ArtefactStatus.READY)


def mark_failed(artefact):
    if artefact.status == ArtefactStatus.FAILED:
        return artefact
    return set_status(artefact, ArtefactStatus.FAILED)


def publish(artefact):
    if artefact.status != ArtefactStatus.READY:
        raise InvalidTransition("Artefact must be ready before publishing.")
    if not artefact.images.filter(slot__in=SLOT_VALUES).count() == 4:
        raise ImageRequired()
    if not Model3D.objects.filter(artefact=artefact).exists():
        raise InvalidTransition("Artefact has no generated model yet.")
    return set_status(artefact, ArtefactStatus.PUBLISHED)


def unpublish(artefact):
    if artefact.status != ArtefactStatus.PUBLISHED:
        raise InvalidTransition("Artefact is not published.")
    return set_status(artefact, ArtefactStatus.READY)


def validate_generation_ready(artefact):
    slots = set(artefact.images.values_list("slot", flat=True))
    if not SLOT_VALUES.issubset(slots):
        raise ImageRequired()
    if not artefact.height_mm or artefact.height_mm <= 0:
        raise HeightRequired()


def save_image(artefact, *, slot, upload, content_type=None, size_bytes=None):
    if slot not in SLOT_VALUES:
        raise ValueError(f"Unknown image slot: {slot!r}")
    content_type = content_type or getattr(upload, "content_type", "") or "image/jpeg"
    path = f"{artefact.id}/{slot}.{storage.extension_for(content_type)}"
    storage.save_uploaded_file(upload, CAPTURES_BUCKET, path, content_type)
    image, _ = ArtefactImage.objects.update_or_create(
        artefact=artefact,
        slot=slot,
        defaults={
            "storage_path": path,
            "content_type": content_type,
            "size_bytes": size_bytes or getattr(upload, "size", None),
        },
    )
    return image


def confirm_image(artefact, *, slot, path, content_type, size_bytes=None):
    if slot not in SLOT_VALUES:
        raise ValueError(f"Unknown image slot: {slot!r}")
    expected_prefix = f"{artefact.id}/"
    if not path.startswith(expected_prefix):
        raise ValueError("Image path does not belong to this artefact.")
    image, _ = ArtefactImage.objects.update_or_create(
        artefact=artefact,
        slot=slot,
        defaults={
            "storage_path": path,
            "content_type": content_type,
            "size_bytes": size_bytes,
        },
    )
    return image


def delete_artefact(artefact):
    for image in artefact.images.all():
        storage.delete_file(CAPTURES_BUCKET, image.storage_path)
    for capture in artefact.captures.all():
        for key in capture.views.values():
            storage.delete_file(CAPTURES_BUCKET, key)
    if hasattr(artefact, "model3d"):
        storage.delete_file(MODELS_BUCKET, artefact.model3d.glb_path)
    if hasattr(artefact, "narration") and artefact.narration.audio_path:
        storage.delete_file(NARRATION_BUCKET, artefact.narration.audio_path)
    artefact.delete()


@transaction.atomic
def replace_current_model(artefact, *, glb_path, size_bytes=None, scale_factor=1.0):
    model, _ = Model3D.objects.update_or_create(
        artefact=artefact,
        defaults={
            "glb_path": glb_path,
            "size_bytes": size_bytes,
            "scale_factor": scale_factor,
        },
    )
    return model