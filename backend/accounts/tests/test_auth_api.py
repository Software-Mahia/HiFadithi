import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.mark.django_db
def test_sign_in_returns_tokens():
    User.objects.create_user(username="lydia", password="x-long-password-1")
    response = APIClient().post(
        "/api/auth/token/", {"username": "lydia", "password": "x-long-password-1"}, format="json"
    )
    assert response.status_code == 200
    assert "access" in response.json()


@pytest.mark.django_db
def test_wrong_password_uses_the_shared_error_shape():
    response = APIClient().post(
        "/api/auth/token/", {"username": "nobody", "password": "wrong"}, format="json"
    )
    assert response.status_code == 401
    assert set(response.json()["error"]) == {"code", "message"}
