"""API endpoints for accounts: keep them thin, call services. Owner: A."""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin

from .models import User
from .serializers import (
    AcceptInviteSerializer,
    InviteSerializer,
    RoleChangeSerializer,
    UserSerializer,
)
from .services import (
    InvalidInvite,
    accept_invite,
    change_role,
    deactivate_user,
    invite_staff,
    invite_user_from_token,
    make_invite_token,
)


class MeView(APIView):
    """The signed-in user (used by the app shell after sign-in)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class InviteStaffView(APIView):
    """invite-staff: admin creates an invite-only account. Returns {profile_id}
    and accept_url — the one-time link the admin gives the person to set their
    first password and sign in."""

    permission_classes = [IsAdmin]

    def post(self, request):
        data = InviteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = invite_staff(invited_by=request.user, **data.validated_data)
        uidb64, token = make_invite_token(user)
        accept_url = request.build_absolute_uri(f"/accept-invite?uid={uidb64}&token={token}")
        return Response(
            {"profile_id": user.pk, "accept_url": accept_url},
            status=status.HTTP_201_CREATED,
        )


class AcceptInviteView(APIView):
    """Invited user sets their first password from the invite link. No sign-in:
    the link's token is the credential. GET previews the invite; POST accepts it."""

    permission_classes = [AllowAny]

    def get(self, request):
        user = invite_user_from_token(
            uidb64=request.query_params.get("uid", ""),
            token=request.query_params.get("token", ""),
        )
        if user is None:
            raise InvalidInvite()
        return Response({"email": user.email, "full_name": user.get_full_name()})

    def post(self, request):
        data = AcceptInviteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = accept_invite(
            uidb64=data.validated_data["uid"],
            token=data.validated_data["token"],
            password=data.validated_data["password"],
        )
        return Response({"profile_id": user.pk})


class ChangeRoleView(APIView):
    """Change another user's role (admin only). Nobody may change their own role."""

    permission_classes = [IsAdmin]

    def post(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        data = RoleChangeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        change_role(user=user, role=data.validated_data["role"], actor=request.user)
        return Response(UserSerializer(user).data)


class DeactivateUserView(APIView):
    """Deactivate a staff member (admin only). They lose access at once."""

    permission_classes = [IsAdmin]

    def post(self, request, user_id):
        user = get_object_or_404(User, pk=user_id)
        deactivate_user(user=user)
        return Response({"id": user.pk, "is_active": user.is_active})
