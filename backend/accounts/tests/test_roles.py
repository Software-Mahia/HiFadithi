import pytest
from django.contrib.auth.models import Group
from django.core.management import call_command

from accounts.models import User


@pytest.mark.django_db
def test_users_join_their_role_group_and_can_open_admin():
    call_command("setup_roles", verbosity=0)
    user = User.objects.create_user(
        username="curator1", password="x-long-password-1", role="curator"
    )
    assert user.is_staff
    assert list(user.groups.values_list("name", flat=True)) == ["curator"]

    user.role = User.Role.RESEARCHER
    user.save()
    assert list(user.groups.values_list("name", flat=True)) == ["researcher"]
    assert Group.objects.filter(name="admin").exists()
