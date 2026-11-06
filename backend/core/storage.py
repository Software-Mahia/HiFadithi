"""Supabase Storage helpers (S3-compatible API). Owner: B.

Buckets are created once in the Supabase dashboard. Use these names everywhere.
"""
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

CAPTURES_BUCKET = "captures"    # captures/{artefact_id}/{capture_id}/{view}.jpg
MODELS_BUCKET = "models"        # models/{artefact_id}/v{version}/model.glb
NARRATION_BUCKET = "narration"  # narration/{artefact_id}/{story_id}.m4a

BUCKETS = {CAPTURES_BUCKET, MODELS_BUCKET, NARRATION_BUCKET}


def _client():
    """An S3 client pointed at Supabase Storage. Settings are read at call time."""
    endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", None)
    region = getattr(settings, "AWS_S3_REGION_NAME", None)
    key = getattr(settings, "AWS_ACCESS_KEY_ID", None)
    secret = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)
    if not (endpoint and region and key and secret):
        raise ImproperlyConfigured(
            "Storage is not configured. Set USE_SUPABASE_STORAGE=True and the "
            "SUPABASE_S3_* values in .env."
        )
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=key,
        aws_secret_access_key=secret,
        config=Config(
            signature_version="s3v4",
            # Supabase does not say which addressing style it supports; test with real keys.
            s3={"addressing_style": getattr(settings, "AWS_S3_ADDRESSING_STYLE", "path")},
        ),
    )


def _check(bucket: str, path: str) -> None:
    if bucket not in BUCKETS:
        raise ValueError(f"Unknown bucket: {bucket!r}")
    if not path or path.startswith("/") or ".." in path.split("/"):
        raise ValueError(f"Bad storage path: {path!r}")


def signed_download_url(bucket: str, path: str, expires_in: int = 3600) -> str:
    """Presigned GET link, valid for `expires_in` seconds (default 1 hour)."""
    _check(bucket, path)
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": path},
        ExpiresIn=expires_in,
    )


def signed_upload_url(
    bucket: str, path: str, expires_in: int = 3600, content_type: str | None = None
) -> str:
    """Presigned PUT link the app uploads to.

    If content_type is given it is part of the signature: the client must send exactly
    that Content-Type header (for photos, "image/jpeg") or storage rejects the upload.
    """
    _check(bucket, path)
    params = {"Bucket": bucket, "Key": path}
    if content_type:
        params["ContentType"] = content_type
    return _client().generate_presigned_url("put_object", Params=params, ExpiresIn=expires_in)


def object_exists(bucket: str, path: str) -> bool:
    """True if the file is in storage. Used to check that all photos were uploaded."""
    _check(bucket, path)
    try:
        _client().head_object(Bucket=bucket, Key=path)
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
            return False
        raise
    return True