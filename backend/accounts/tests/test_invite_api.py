import pytest
from rest_framework.test import APIClient

from accounts.models import User

pytestmark = pytest.mark.django_db


def make(username, role=User.Role.RESEARCHER):
    return User.objects.create_user(username=username, password="x-long-password-1", role=role)


def auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_admin_invites_staff_and_gets_a_profile_id():
    admin = make("admin", role=User.Role.ADMIN)
    response = auth_client(admin).post(
        "/api/accounts/invite/",
        {"email": "Lydia@nmk.go.ke", "full_name": "Lydia Mwangi", "role": "curator"},
        format="json",
    )
    assert response.status_code == 201
    pid = response.json()["profile_id"]
    invited = User.objects.get(pk=pid)
    assert invited.email == "lydia@nmk.go.ke"
    assert invited.username == "lydia@nmk.go.ke"
    assert invited.role == "curator"
    assert invited.first_name == "Lydia" and invited.last_name == "Mwangi"
    # Invite-only: no usable password until acceptance, so they cannot sign in yet.
    assert not invited.has_usable_password()


def test_non_admin_cannot_invite():
    researcher = make("researcher")
    response = auth_client(researcher).post(
        "/api/accounts/invite/",
        {"email": "x@nmk.go.ke", "full_name": "X", "role": "researcher"},
        format="json",
    )
    assert response.status_code == 403
    assert set(response.json()["error"]) == {"code", "message"}


def test_unauthenticated_invite_is_401():
    response = APIClient().post(
        "/api/accounts/invite/",
        {"email": "x@nmk.go.ke", "full_name": "X", "role": "researcher"},
        format="json",
    )
    assert response.status_code == 401
    assert set(response.json()["error"]) == {"code", "message"}


def test_duplicate_email_is_409():
    admin = make("admin", role=User.Role.ADMIN)
    make("taken@nmk.go.ke")
    response = auth_client(admin).post(
        "/api/accounts/invite/",
        {"email": "taken@nmk.go.ke", "full_name": "Dup", "role": "researcher"},
        format="json",
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "already_invited"


def test_bad_role_is_422():
    admin = make("admin", role=User.Role.ADMIN)
    response = auth_client(admin).post(
        "/api/accounts/invite/",
        {"email": "new@nmk.go.ke", "full_name": "New", "role": "wizard"},
        format="json",
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_role"


def test_admin_deactivates_a_user():
    admin = make("admin", role=User.Role.ADMIN)
    victim = make("leaver")
    response = auth_client(admin).post(f"/api/accounts/{victim.pk}/deactivate/")
    assert response.status_code == 200
    assert response.json() == {"id": victim.pk, "is_active": False}
    victim.refresh_from_db()
    assert victim.is_active is False and victim.is_staff is False


def test_non_admin_cannot_deactivate():
    researcher = make("researcher")
    victim = make("victim")
    response = auth_client(researcher).post(f"/api/accounts/{victim.pk}/deactivate/")
    assert response.status_code == 403
