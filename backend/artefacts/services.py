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