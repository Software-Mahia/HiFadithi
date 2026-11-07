"""API input and output shapes for accounts. Owner: A."""
from rest_framework import serializers

from .models import User


class InviteSerializer(serializers.Serializer):
    """Input for invite-staff. Role is validated in the service so an unknown role
    returns 422 bad_role (not a 400), per the server contract."""

    email = serializers.EmailField()
    full_name = serializers.CharField(max_length=200)
    role = serializers.CharField(max_length=20)


class RoleChangeSerializer(serializers.Serializer):
    """Input for role change. Role validated in the service (422 bad_role, not 400)."""

    role = serializers.CharField(max_length=20)


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    # Ported: the mobile app's profile screen uses display_name + department.
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "username", "email", "full_name", "display_name", "role",
            "department", "is_active",
        )

    def get_full_name(self, obj):
        return obj.get_full_name()

    def get_display_name(self, obj):
        return obj.get_full_name() or obj.get_username()
