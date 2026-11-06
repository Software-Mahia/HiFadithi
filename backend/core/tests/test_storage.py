from urllib.parse import parse_qs, urlparse

import pytest
from botocore.exceptions import ClientError
from django.core.exceptions import ImproperlyConfigured

from core import storage


@pytest.fixture(autouse=True)
def fake_storage_settings(settings):
    settings.AWS_S3_ENDPOINT_URL = "https://abcd.storage.supabase.co/storage/v1/s3"
    settings.AWS_S3_REGION_NAME = "eu-central-1"
    settings.AWS_ACCESS_KEY_ID = "test-key"
    settings.AWS_SECRET_ACCESS_KEY = "test-secret"


PATH = "art-1/cap-1/front.jpg"


def test_download_url_points_at_the_bucket_and_path():
    url = urlparse(storage.signed_download_url(storage.CAPTURES_BUCKET, PATH))
    assert url.scheme == "https"
    assert url.hostname == "abcd.storage.supabase.co"
    assert url.path == f"/storage/v1/s3/captures/{PATH}"


def test_download_url_is_signed_and_expires_in_one_hour_by_default():
    query = parse_qs(urlparse(storage.signed_download_url(storage.CAPTURES_BUCKET, PATH)).query)
    assert query["X-Amz-Algorithm"] == ["AWS4-HMAC-SHA256"]
    assert query["X-Amz-Expires"] == ["3600"]
    assert query["X-Amz-Signature"]


def test_expiry_can_be_changed():
    url = storage.signed_download_url(storage.CAPTURES_BUCKET, PATH, expires_in=21600)
    assert parse_qs(urlparse(url).query)["X-Amz-Expires"] == ["21600"]


def test_the_secret_key_never_appears_in_a_link():
    assert "test-secret" not in storage.signed_download_url(storage.CAPTURES_BUCKET, PATH)


def test_upload_url_requires_the_content_type_when_one_is_given():
    url = storage.signed_upload_url(storage.CAPTURES_BUCKET, PATH, content_type="image/jpeg")
    signed_headers = parse_qs(urlparse(url).query)["X-Amz-SignedHeaders"][0]
    assert "content-type" in signed_headers.split(";")


def test_upload_url_without_content_type_does_not_sign_it():
    url = storage.signed_upload_url(storage.CAPTURES_BUCKET, PATH)
    signed_headers = parse_qs(urlparse(url).query)["X-Amz-SignedHeaders"][0]
    assert "content-type" not in signed_headers.split(";")


def test_unknown_bucket_is_rejected():
    with pytest.raises(ValueError):
        storage.signed_download_url("secrets", PATH)


@pytest.mark.parametrize("bad", ["", "/abs/path.jpg", "a/../b.jpg", "../x.jpg"])
def test_bad_paths_are_rejected(bad):
    with pytest.raises(ValueError):
        storage.signed_download_url(storage.CAPTURES_BUCKET, bad)


def test_missing_configuration_gives_a_clear_error(settings):
    settings.AWS_S3_ENDPOINT_URL = None
    with pytest.raises(ImproperlyConfigured, match="USE_SUPABASE_STORAGE"):
        storage.signed_download_url(storage.CAPTURES_BUCKET, PATH)

class FakeClient:
    def __init__(self, code=None):
        self.code = code

    def head_object(self, **kwargs):
        if self.code:
            raise ClientError({"Error": {"Code": self.code}}, "HeadObject")
        return {}


def test_object_exists_is_true_when_the_file_is_there(monkeypatch):
    monkeypatch.setattr(storage, "_client", lambda: FakeClient())
    assert storage.object_exists(storage.CAPTURES_BUCKET, PATH) is True


def test_object_exists_is_false_when_the_file_is_missing(monkeypatch):
    monkeypatch.setattr(storage, "_client", lambda: FakeClient("404"))
    assert storage.object_exists(storage.CAPTURES_BUCKET, PATH) is False


def test_object_exists_does_not_hide_other_errors(monkeypatch):
    monkeypatch.setattr(storage, "_client", lambda: FakeClient("403"))
    with pytest.raises(ClientError):
        storage.object_exists(storage.CAPTURES_BUCKET, PATH)