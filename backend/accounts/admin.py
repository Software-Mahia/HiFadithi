"""Staff accounts are created here for the pilot. Owner: A."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from core.admin import service_action

from .models import User
from .services import deactivate_user


@admin.register(User)
class HiFadithiUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("HiFadithi", {"fields": ("role", "department")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("HiFadithi", {"fields": ("role",)}),)
    list_display = ("username", "email", "role", "is_active")
    list_filter = ("role", "is_active")
    # Deactivation goes through the service (is_staff follows is_active), not a raw edit.
    actions = [
        service_action(
            "Deactivate selected staff (lose access now)",
            lambda user, actor: deactivate_user(user=user),
            success="Deactivated {count} user(s).",
        ),
    ]
