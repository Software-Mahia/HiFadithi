import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse

from ocr import services


@pytest.mark.django_db
def test_ocr_endpoint_returns_parsed_fields(auth_client, monkeypatch):
    monkeypatch.setattr(
        services,
        "extract_text",
        lambda data: {
            "raw_text": "Accession No: NMK/1\nObject: Pot\nMaterial: Clay",
            "confidence": 91.5,
        },
    )
    upload = SimpleUploadedFile("card.jpg", b"fake", content_type="image/jpeg")
    response = auth_client.post(reverse("ocr"), {"image": upload}, format="multipart")
    assert response.status_code == 200, response.content
    body = response.json()
    assert body["fields"]["accession_number"] == "NMK/1"
    assert body["fields"]["name"] == "Pot"
    assert body["confidence"] == 91.5


@pytest.mark.django_db
def test_ocr_requires_image(auth_client):
    response = auth_client.post(reverse("ocr"), {}, format="multipart")
    assert response.status_code == 400


@pytest.mark.django_db
def test_ocr_reports_unavailable(auth_client, monkeypatch):
    def unavailable(data):
        raise services.OCRUnavailable("Tesseract is not installed.")

    monkeypatch.setattr(services, "extract_text", unavailable)
    upload = SimpleUploadedFile("card.jpg", b"fake", content_type="image/jpeg")
    response = auth_client.post(reverse("ocr"), {"image": upload}, format="multipart")
    assert response.status_code == 503
