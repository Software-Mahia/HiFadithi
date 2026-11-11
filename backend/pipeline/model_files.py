"""Copy a finished model from Meshy into our own storage. Owner: C.

Meshy's download links expire (files are kept for 3 days), so the webhook copies the GLB
into the private `models` bucket straight away and stores only our own path.

    models/{artefact_id}/v{version}/model.glb   (the path is stored without the bucket name)

With USE_SUPABASE_STORAGE off, files go to MEDIA_ROOT/models/ on your laptop instead.
"""
import logging
from collections.abc import Callable
from dataclasses import dataclass

import httpx
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage

from core.storage import MODELS_BUCKET

from .glb import GlbError, GlbInfo, read_glb_info
from .textures import optimize_glb

logger = logging.getLogger(__name__)

MAX_GLB_BYTES = 100 * 1024 * 1024  # a 30k-triangle textured model is usually 5-20 MB
DOWNLOAD_TIMEOUT = httpx.Timeout(15.0, connect=5.0)  # Meshy wants a webhook reply within ~25 s
MAX_REDIRECTS = 3
REDIRECT_CODES = {301, 302, 303, 307, 308}


class ModelCopyError(Exception):
    """The model could not be downloaded or is not a usable GLB. The message is safe to store."""


@dataclass(frozen=True)
class StoredModel:
    path: str
    info: GlbInfo


def model_path(artefact_id, version: int) -> str:
    return f"{artefact_id}/v{version}/model.glb"


def models_storage():
    """The storage for the `models` bucket (Supabase), or a local folder in development."""
    if "s3" in settings.STORAGES["default"]["BACKEND"].lower():
        from storages.backends.s3 import S3Storage

        return S3Storage(bucket_name=MODELS_BUCKET, file_overwrite=True)
    return FileSystemStorage(location=settings.MEDIA_ROOT / MODELS_BUCKET)


def copy_model(
    glb_url: str,
    path: str,
    *,
    allowed: Callable[[str], bool] | None = None,
    client: httpx.Client | None = None,
    storage=None,
):
    """Download the GLB, check it is a readable model, save it at `path`. Returns StoredModel."""
    data = _download(glb_url, client or httpx.Client(timeout=DOWNLOAD_TIMEOUT), allowed)
    try:
        info = read_glb_info(data)
    except GlbError as exc:
        raise ModelCopyError(f"Meshy's model file can't be used: {exc}") from exc

    # Smaller textures = faster download and display on phones. Geometry is untouched;
    # if the optimised file does not read back cleanly, the original is kept.
    optimised, report = optimize_glb(data)
    if report.images_changed:
        try:
            info = read_glb_info(optimised)
            data = optimised
            logger.info(
                "Optimised model textures: %s -> %s bytes (%s images)",
                report.before_bytes,
                report.after_bytes,
                report.images_changed,
            )
        except GlbError:
            logger.warning("Optimised model did not read back; storing the original.")

    storage = storage or models_storage()
    if storage.exists(path):  # FileSystemStorage would otherwise save under a new name
        storage.delete(path)
    saved = storage.save(path, ContentFile(data))
    return StoredModel(path=saved, info=info)


def fill_model_version(model_version, stored: StoredModel) -> None:
    """Record the copied file and its measurements on the ModelVersion.

    scale_factor is left alone: it relates the model to the real object and is set at
    verification. Status is not touched here: that goes through transition_model().
    """
    model_version.glb_path = stored.path
    model_version.size_bytes = stored.info.size_bytes
    model_version.triangles = stored.info.triangles
    model_version.bbox_width_mm = stored.info.width_mm
    model_version.bbox_depth_mm = stored.info.depth_mm
    model_version.save(
        update_fields=["glb_path", "size_bytes", "triangles", "bbox_width_mm", "bbox_depth_mm"]
    )


def _download(url: str, client: httpx.Client, allowed=None) -> bytes:
    """Follow at most MAX_REDIRECTS redirects, checking every hop with `allowed`."""
    try:
        for _ in range(MAX_REDIRECTS + 1):
            if allowed is not None and not allowed(url):
                raise ModelCopyError("The model link points outside the 3D service.")
            with client.stream("GET", url, follow_redirects=False) as response:
                if response.status_code in REDIRECT_CODES and "Location" in response.headers:
                    url = str(response.url.join(response.headers["Location"]))
                    continue
                return _read_body(response)
        raise ModelCopyError("The model link redirected too many times.")
    except httpx.HTTPError as exc:
        raise ModelCopyError(f"Could not download the model ({type(exc).__name__}).") from exc


def _read_body(response) -> bytes:
    if response.status_code != 200:
        raise ModelCopyError(f"Could not download the model (HTTP {response.status_code}).")
    declared = response.headers.get("Content-Length")
    if declared and declared.isdigit() and int(declared) > MAX_GLB_BYTES:
        raise ModelCopyError("The model file is larger than 100 MB.")
    chunks, total = [], 0
    for chunk in response.iter_bytes():
        total += len(chunk)
        if total > MAX_GLB_BYTES:
            raise ModelCopyError("The model file is larger than 100 MB.")
        chunks.append(chunk)
    return b"".join(chunks)
