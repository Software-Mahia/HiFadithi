"""API endpoints for accounts: keep them thin, call services. Owner: A."""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin

from .models import User
from .serializers import InviteSerializer, RoleChangeSerializer, UserSerializer
from .services import change_role, deactivate_user, invite_staff


class MeView(APIView):
    """The signed-in user (used by the app shell after sign-in)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class InviteStaffView(APIView):
    """invite-staff: admin creates an invite-only account. Returns {profile_id}."""

    permission_classes = [IsAdmin]

    def post(self, request):
        data = InviteSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = invite_staff(invited_by=request.user, **data.validated_data)
        return Response({"profile_id": user.pk}, status=status.HTTP_201_CREATED)


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
