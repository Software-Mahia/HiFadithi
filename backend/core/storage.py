"""Storage for photos, GLBs and narration (S3-compatible Supabase Storage).

Moved-in behaviour from the hifadithi MVP: in development, with no Supabase S3
credentials configured, the same helpers write to MEDIA_ROOT and return local
media URLs, so the API and the mobile app work without cloud credentials.
Owner: B (helpers) / porter (local fallback).
"""
import mimetypes
import os
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

CAPTURES_BUCKET = "captures"    # captures/{artefact_id}/{capture_id}/{view}.jpg
MODELS_BUCKET = "models"        # models/{artefact_id}/v{version}/model.glb
NARRATION_BUCKET = "narration"  # narration/{artefact_id}/{story_id}.m4a

BUCKETS = {CAPTURES_BUCKET, MODELS_BUCKET, NARRATION_BUCKET}


def s3_enabled() -> bool:
    """True when Supabase S3 credentials are configured (port: added LocalDev mode)."""
    return all(
        getattr(settings, name, None)
        for name in ("AWS_S3_ENDPOINT_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY")
    )


def upload_strategy() -> str:
    """The app asks for this once per upload: "presigned" = PUT to a bucket link,
    "direct" = multipart POST to /api/artefacts/<id>/images/ (local disk)."""
    return "presigned" if s3_enabled() else "direct"


def _check(bucket: str, path: str) -> None:
    if bucket not in BUCKETS:
        raise ValueError(f"Unknown bucket: {bucket!r}")
    if not path or path.startswith("/") or ".." in path.split("/"):
        raise ValueError(f"Bad storage path: {path!r}")


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


def signed_download_url(bucket: str, path: str, expires_in: int | None = None) -> str:
    """Presigned GET link; LOCALDEV: an absolute /media/ URL when Supabase is off."""
    _check(bucket, path)
    if not s3_enabled():
        base = getattr(settings, "PUBLIC_BASE_URL", "http://127.0.0.1:8000").rstrip("/")
        return f"{base}{settings.MEDIA_URL}{bucket}/{path}"
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": path},
        ExpiresIn=expires_in or getattr(settings, "PRESIGN_EXPIRES_SECONDS", 3600),
    )


def signed_upload_url(
    bucket: str, path: str, content_type: str | None = None, expires_in: int = 3600
) -> str | None:
    """Presigned PUT link the app uploads to, or None when local disk is active.

    If content_type is given it is part of the signature: the client must send exactly
    that Content-Type header ("image/jpeg") or storage rejects the upload.
    (Port note: reordered to (bucket, path, content_type, expires_in) so ported MVP
    services can pass the content type positionally; HiFadithi callers all use kwargs.)
    """
    _check(bucket, path)
    if not s3_enabled():
        return None
    params = {"Bucket": bucket, "Key": path}
    if content_type:
        params["ContentType"] = content_type
    return _client().generate_presigned_url(
        "put_object", Params=params, ExpiresIn=expires_in
    )


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


# --- local-disk fallback (ported from the hifadithi MVP) ---------------------

def _local_path(bucket: str, path: str) -> Path:
    target = Path(settings.MEDIA_ROOT) / bucket / path
    root = (Path(settings.MEDIA_ROOT) / bucket).resolve()
    if root not in target.resolve().parents:
        raise ValueError(f"Bad storage path: {path!r}")
    return target


def open_stream(bucket: str, path: str):
    """Stream a stored object: (iterator, size, content_type, etag).
    Prefers the S3 body; falls back to the local FS mirror when Supabase is off."""
    _check(bucket, path)
    if s3_enabled():
        response = _client().get_object(Bucket=bucket, Key=path)
        body = response["Body"]
        return (
            body.iter_chunks(),
            response.get("ContentLength"),
            response.get("ContentType", "application/octet-stream"),
            response.get("ETag", "").strip('"'),
        )
    local = _local_path(bucket, path)
    if not local.is_file():
        raise FileNotFoundError(path)
    return open(local, "rb"), local.stat().st_size, "application/octet-stream", ""


def save_bytes(bucket: str, path: str, data: bytes, content_type: str | None = None) -> str:
    _check(bucket, path)
    if s3_enabled():
        extra = {"ContentType": content_type} if content_type else {}
        _client().put_object(Bucket=bucket, Key=path, Body=data, **extra)
    else:
        target = _local_path(bucket, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    return path


def save_uploaded_file(upload, bucket: str, path: str, content_type: str | None = None) -> str:
    _check(bucket, path)
    if s3_enabled():
        extra = {"ContentType": content_type} if content_type else {}
        _client().upload_fileobj(upload, bucket, path, ExtraArgs=extra)
    else:
        target = _local_path(bucket, path)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("wb") as destination:
            for chunk in upload.chunks():
                destination.write(chunk)
    return path


def delete_file(bucket: str, path: str) -> None:
    _check(bucket, path)
    if s3_enabled():
        _client().delete_object(Bucket=bucket, Key=path)
        return
    target = _local_path(bucket, path)
    if target.exists():
        target.unlink()


def content_type_for(path: str) -> str:
    return mimetypes.guess_type(path)[0] or "application/octet-stream"


def extension_for(content_type: str) -> str:
    return {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }.get(content_type, "bin")


def file_size(path: Path) -> int:
    return os.path.getsize(path)
