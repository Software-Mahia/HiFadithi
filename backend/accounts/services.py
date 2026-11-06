"""Everything in accounts that WRITES. Owner: A.

Custom User (role field), sign-in, invite and deactivation.
"""
from rest_framework import status
from rest_framework.exceptions import APIException

from .models import User


class AlreadyInvited(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "already_invited"
    default_detail = "A user with this email already exists."


class BadRole(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "bad_role"
    default_detail = "Unknown role."


def _split_name(full_name):
    full_name = (full_name or "").strip()
    if not full_name:
        return "", ""
    first, _, last = full_name.partition(" ")
    return first, last.strip()


def invite_staff(*, email, full_name, role, invited_by=None):
    """Create an invite-only staff account (BR-1 roles, invite-only Auth).

    The account starts active with an unusable password; the person sets a password
    through invite acceptance (deferred) before they can sign in. Returns the User.
    Raises BadRole (422) for an unknown role, AlreadyInvited (409) for a duplicate email.
    """
    email = (email or "").strip().lower()
    if role not in User.Role.values:
        raise BadRole()
    if User.objects.filter(email__iexact=email).exists() or User.objects.filter(
        username__iexact=email
    ).exists():
        raise AlreadyInvited()

    first, last = _split_name(full_name)
    user = User(
        username=email, email=email, first_name=first, last_name=last,
        role=role, is_active=True,
    )
    user.set_unusable_password()
    user.save()
    return user


def deactivate_user(*, user):
    """Deactivate a staff member: they lose access at once (sign-in stops working).

    is_staff follows is_active in User.save(), so admin access is removed too.
    Their records are kept. Returns the User.
    """
    user.is_active = False
    user.save()
    return user
