"""Role checks used by every endpoint. Owner: A."""
from rest_framework.permissions import BasePermission


class _HasRole(BasePermission):
    roles: tuple[str, ...] = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_active and user.role in self.roles)


class IsResearcher(_HasRole):
    roles = ("researcher",)


class IsCurator(_HasRole):
    roles = ("curator",)


class IsAdmin(_HasRole):
    roles = ("admin",)
