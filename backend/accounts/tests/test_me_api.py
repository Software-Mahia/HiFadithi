import pytest
from rest_framework.test import APIClient

from accounts.models import User

pytestmark = pytest.mark.django_db


def test_me_returns_the_signed_in_user():
    user = User.objects.create_user(
        username="lydia", password="x-long-password-1", email="lydia@nmk.go.ke",
        first_name="Lydia", last_name="Mwangi", role=User.Role.CURATOR,
    )
    client = APIClient()
    client.force_authenticate(user=user)
    body = client.get("/api/accounts/me/").json()
    assert body["username"] == "lydia"
    assert body["role"] == "curator"
    assert body["full_name"] == "Lydia Mwangi"
    assert body["is_active"] is True


def test_me_requires_authentication():
    response = APIClient().get("/api/accounts/me/")
    assert response.status_code == 401
    assert set(response.json()["error"]) == {"code", "message"}
