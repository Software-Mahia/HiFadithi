import pytest
from django.test import Client

from accounts.models import User

pytestmark = pytest.mark.django_db

# Name derived from the action description by core.admin.service_action().
ACTION = "action_deactivate_selected_staff__lose_access_now_"


def test_admin_deactivate_action_calls_the_service():
    admin_user = User.objects.create_superuser(
        username="root", password="x-long-password-1", role=User.Role.ADMIN
    )
    target = User.objects.create_user(username="leaver", password="x-long-password-1")

    client = Client()
    client.force_login(admin_user)
    response = client.post(
        "/admin/accounts/user/",
        {"action": ACTION, "_selected_action": [str(target.pk)]},
        follow=True,
    )
    assert response.status_code == 200
    target.refresh_from_db()
    assert target.is_active is False
    assert target.is_staff is False
