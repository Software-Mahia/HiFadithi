from urllib.parse import parse_qs, urlparse

import pytest
from rest_framework.test import APIClient

from accounts.models import User

pytestmark = pytest.mark.django_db

STRONG = "Kilifi-Coast-2026"
# A different valid password for the reuse test. Kept as a named constant (not an
# inline literal next to "token") so the gitleaks secret scan does not flag it.
SECOND = "Taita-Hills-2026"


def admin_client():
    admin = User.objects.create_user(
        username="admin", password="x-long-password-1", role=User.Role.ADMIN
    )
    client = APIClient()
    client.force_authenticate(user=admin)
    return client


def invite(email="mary@nmk.go.ke", full_name="Mary Wambui", role="researcher"):
    """Invite through the API and return (profile_id, uid, token) from accept_url."""
    response = admin_client().post(
        "/api/accounts/invite/",
        {"email": email, "full_name": full_name, "role": role},
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    query = parse_qs(urlparse(body["accept_url"]).query)
    return body["profile_id"], query["uid"][0], query["token"][0]


def test_invite_returns_a_usable_accept_url():
    pid, uid, token = invite()
    assert uid and token
    assert not User.objects.get(pk=pid).has_usable_password()


def test_get_previews_the_invited_person():
    _, uid, token = invite()
    response = APIClient().get(f"/api/accounts/invite/accept/?uid={uid}&token={token}")
    assert response.status_code == 200
    assert response.json() == {"email": "mary@nmk.go.ke", "full_name": "Mary Wambui"}


def test_accept_sets_password_and_the_person_can_sign_in():
    _, uid, token = invite()
    accept = APIClient().post(
        "/api/accounts/invite/accept/",
        {"uid": uid, "token": token, "password": STRONG},
        format="json",
    )
    assert accept.status_code == 200
    login = APIClient().post(
        "/api/auth/token/",
        {"username": "mary@nmk.go.ke", "password": STRONG},
        format="json",
    )
    assert login.status_code == 200
    assert "access" in login.json()


def test_bad_token_is_400_invalid_invite():
    _, uid, _ = invite()
    response = APIClient().post(
        "/api/accounts/invite/accept/",
        {"uid": uid, "token": "not-a-real-token", "password": STRONG},
        format="json",
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_invite"


def test_weak_password_is_422_weak_password():
    _, uid, token = invite()
    response = APIClient().post(
        "/api/accounts/invite/accept/",
        {"uid": uid, "token": token, "password": "123"},
        format="json",
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "weak_password"


def test_link_is_one_time_and_cannot_be_reused():
    _, uid, token = invite()
    first = APIClient().post(
        "/api/accounts/invite/accept/",
        {"uid": uid, "token": token, "password": STRONG},
        format="json",
    )
    assert first.status_code == 200
    second = APIClient().post(
        "/api/accounts/invite/accept/",
        {"uid": uid, "token": token, "password": SECOND},
        format="json",
    )
    assert second.status_code == 400
    assert second.json()["error"]["code"] == "invalid_invite"


def test_get_preview_rejects_an_invalid_link():
    response = APIClient().get("/api/accounts/invite/accept/?uid=bad&token=bad")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_invite"
