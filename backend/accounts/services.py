"""Everything in accounts that WRITES. Owner: A.

Custom User (role field), sign-in, invite and deactivation.
"""
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.exceptions import APIException

from .models import User


class AlreadyInvited(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "already_invited"
    default_detail = "A user with this email already exists."


class InvalidInvite(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid_invite"
    default_detail = "This invite link is invalid, used or expired."


class WeakPassword(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "weak_password"
    default_detail = "That password is not strong enough."


class BadRole(APIException):
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = "bad_role"
    default_detail = "Unknown role."


class CannotChangeOwnRole(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_code = "cannot_change_own_role"
    default_detail = "You cannot change your own role."


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


def make_invite_token(user):
    """uid + token for an invite-acceptance link. Uses Django's password-reset
    token: it expires with PASSWORD_RESET_TIMEOUT and stops working once the
    account has a usable password, so a link is one-time."""
    return urlsafe_base64_encode(force_bytes(user.pk)), default_token_generator.make_token(user)


def _user_from_uid(uidb64):
    try:
        pk = force_str(urlsafe_base64_decode(uidb64))
        return User.objects.get(pk=pk)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return None


def invite_user_from_token(*, uidb64, token):
    """The invited user when uid+token are valid and the account is still active
    and awaiting its first password, else None."""
    user = _user_from_uid(uidb64 or "")
    if user is None or not user.is_active or user.has_usable_password():
        return None
    if not default_token_generator.check_token(user, token or ""):
        return None
    return user


def accept_invite(*, uidb64, token, password):
    """Set an invited user's first password so they can sign in. Raises
    InvalidInvite (400) for a bad, used or expired link and WeakPassword (422)
    when the password fails the validators."""
    user = invite_user_from_token(uidb64=uidb64, token=token)
    if user is None:
        raise InvalidInvite()
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise WeakPassword(detail=" ".join(exc.messages))
    user.set_password(password)
    user.save(update_fields=["password"])
    return user


def change_role(*, user, role, actor):
    """Change a staff member's role (admin only; enforced in the view).

    Refuses an admin changing their OWN role (prevents self-lockout and satisfies
    "nobody can change their own role"). Raises BadRole (422) for an unknown role.
    """
    if role not in User.Role.values:
        raise BadRole()
    if actor is not None and actor.pk == user.pk:
        raise CannotChangeOwnRole()
    user.role = role
    user.save(update_fields=["role"])
    return user


def deactivate_user(*, user):
    """Deactivate a staff member: they lose access at once (sign-in stops working).

    is_staff follows is_active in User.save(), so admin access is removed too.
    Their records are kept. Returns the User.
    """
    user.is_active = False
    user.save()
    return user
