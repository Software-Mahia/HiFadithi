"""Staff accounts are created here for the pilot. Owner: A."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class HiFadithiUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("HiFadithi", {"fields": ("role", "department")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("HiFadithi", {"fields": ("role",)}),)
    list_display = ("username", "email", "role", "is_active")
    list_filter = ("role", "is_active")
