"""Copying Meshy's GLB into our storage. Fake HTTP server and a temporary folder; no network."""
import httpx
import pytest
from django.core.files.storage import FileSystemStorage

from pipeline.model_files import (
    ModelCopyError,
    copy_model,
    fill_model_version,
    model_path,
)

from .glb_factory import box_gltf, make_glb

GLB = make_glb(box_gltf(size=(0.2, 0.3, 0.1), triangles=12))


def client_returning(response):
    return httpx.Client(transport=httpx.MockTransport(lambda request: response))


@pytest.fixture
def storage(tmp_path):
    return FileSystemStorage(location=tmp_path)


def test_model_path_follows_the_bucket_layout():
    assert model_path("abc-123", 2) == "abc-123/v2/model.glb"


def test_copies_the_file_and_reads_its_size(storage):
    stored = copy_model(
        "https://assets.meshy.ai/x.glb", "a1/v1/model.glb",
        client=client_returning(httpx.Response(200, content=GLB)), storage=storage,
    )
    assert stored.path == "a1/v1/model.glb"
    assert storage.open("a1/v1/model.glb").read() == GLB
    assert (stored.info.width_mm, stored.info.depth_mm, stored.info.triangles) == (200, 100, 12)


def test_copying_again_replaces_the_file_at_the_same_path(storage):
    for _ in range(2):
        stored = copy_model(
            "https://x/m.glb", "a1/v1/model.glb",
            client=client_returning(httpx.Response(200, content=GLB)), storage=storage,
        )
    assert stored.path == "a1/v1/model.glb"  # not model_abc123.glb


def test_an_expired_link_is_a_clear_error(storage):
    with pytest.raises(ModelCopyError, match="HTTP 403"):
        copy_model("https://x/m.glb", "a1/v1/model.glb",
                   client=client_returning(httpx.Response(403)), storage=storage)
    assert not storage.exists("a1/v1/model.glb")


def test_a_file_that_is_not_a_glb_is_not_saved(storage):
    with pytest.raises(ModelCopyError, match="Not a GLB"):
        copy_model("https://x/m.glb", "a1/v1/model.glb",
                   client=client_returning(httpx.Response(200, content=b"<html>oops</html>")),
                   storage=storage)
    assert not storage.exists("a1/v1/model.glb")


def test_a_too_large_file_is_refused(storage, monkeypatch):
    monkeypatch.setattr("pipeline.model_files.MAX_GLB_BYTES", 10)
    with pytest.raises(ModelCopyError, match="larger than"):
        copy_model("https://x/m.glb", "a1/v1/model.glb",
                   client=client_returning(httpx.Response(200, content=GLB)), storage=storage)


def test_a_network_failure_is_a_clear_error(storage):
    def handler(request):
        raise httpx.ReadTimeout("slow", request=request)

    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(ModelCopyError, match="ReadTimeout"):
        copy_model("https://x/m.glb", "a1/v1/model.glb", client=client, storage=storage)


def test_fill_model_version_records_path_and_sizes_but_not_scale_or_status(storage):
    stored = copy_model("https://x/m.glb", "a1/v1/model.glb",
                        client=client_returning(httpx.Response(200, content=GLB)), storage=storage)

    class FakeVersion:
        scale_factor = 1.0
        review_status = "processing"

        def save(self, update_fields):
            self.saved_fields = update_fields

    version = FakeVersion()
    fill_model_version(version, stored)

    assert version.glb_path == "a1/v1/model.glb"
    assert (version.bbox_width_mm, version.bbox_depth_mm, version.triangles) == (200, 100, 12)
    assert version.size_bytes == len(GLB)
    assert "scale_factor" not in version.saved_fields
    assert "review_status" not in version.saved_fields
