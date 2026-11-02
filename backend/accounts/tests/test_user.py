import pytest

from accounts.models import User


@pytest.mark.django_db
def test_new_user_defaults_to_researcher():
    user = User.objects.create_user(username="lydia", password="x-long-password-1")
    assert user.role == User.Role.RESEARCHER
