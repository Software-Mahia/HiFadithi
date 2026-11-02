"""Supabase Storage helpers (S3-compatible API). Owner: B.

Buckets are created once in the Supabase dashboard. Use these names everywhere.
"""

CAPTURES_BUCKET = "captures"    # captures/{artefact_id}/{capture_id}/{view}.jpg
MODELS_BUCKET = "models"        # models/{artefact_id}/v{version}/model.glb
NARRATION_BUCKET = "narration"  # narration/{artefact_id}/{story_id}.m4a


def signed_download_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """TODO (B): presigned GET link, valid for 1 hour."""
    raise NotImplementedError


def signed_upload_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """TODO (B): presigned PUT link the app uploads photos to."""
    raise NotImplementedError
