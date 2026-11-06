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


def test_admin_changes_another_users_role():
    admin = make("admin", role=User.Role.ADMIN)
    target = make("researcher")
    response = auth_client(admin).post(
        f"/api/accounts/{target.pk}/role/", {"role": "curator"}, format="json"
    )
    assert response.status_code == 200
    assert response.json()["role"] == "curator"
    target.refresh_from_db()
    assert target.role == "curator"


def test_nobody_can_change_their_own_role():
    admin = make("admin", role=User.Role.ADMIN)
    response = auth_client(admin).post(
        f"/api/accounts/{admin.pk}/role/", {"role": "researcher"}, format="json"
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "cannot_change_own_role"
    admin.refresh_from_db()
    assert admin.role == "admin"


def test_non_admin_cannot_change_roles():
    researcher = make("researcher")
    target = make("other")
    response = auth_client(researcher).post(
        f"/api/accounts/{target.pk}/role/", {"role": "curator"}, format="json"
    )
    assert response.status_code == 403
    target.refresh_from_db()
    assert target.role == "researcher"


def test_unknown_role_is_422():
    admin = make("admin", role=User.Role.ADMIN)
    target = make("target")
    response = auth_client(admin).post(
        f"/api/accounts/{target.pk}/role/", {"role": "wizard"}, format="json"
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_role"


def test_role_change_requires_authentication():
    target = make("target")
    response = APIClient().post(
        f"/api/accounts/{target.pk}/role/", {"role": "curator"}, format="json"
    )
    assert response.status_code == 401
