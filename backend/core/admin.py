"""Shared Django admin helpers for the demo screens. Owner: A.

1. ProtectedStatusAdminMixin: shows protected fields as read-only, so nobody can
   edit a status by hand in admin.
2. service_action(): builds an admin action ("Approve", "Verify"...) that calls a
   service function for each selected row and shows the rule's error on screen
   instead of editing fields.

Example (workflow/admin.py, once ModelVersion exists):

    @admin.register(ModelVersion)
    class ModelVersionAdmin(ProtectedStatusAdminMixin, admin.ModelAdmin):
        protected_fields = ("review_status", "is_current")
        actions = [
            service_action(
                "Approve into the collection",
                lambda version, user: transition_model(version, "approved", actor=user),
                success="Approved {count} version(s).",
            ),
        ]
"""
from django.contrib import admin, messages
from django.core.exceptions import PermissionDenied, ValidationError


class ProtectedStatusAdminMixin:
    protected_fields: tuple[str, ...] = ()

    def get_readonly_fields(self, request, obj=None):
        return tuple(super().get_readonly_fields(request, obj)) + tuple(self.protected_fields)


def service_action(description, service, *, success="Done for {count} item(s)."):
    """Admin action that calls service(obj, request.user) and reports each rule error."""

    @admin.action(description=description)
    def action(modeladmin, request, queryset):
        done = 0
        for obj in queryset:
            try:
                service(obj, request.user)
                done += 1
            except (PermissionDenied, ValidationError, ValueError) as exc:
                modeladmin.message_user(request, f"{obj}: {exc}", level=messages.ERROR)
        if done:
            modeladmin.message_user(request, success.format(count=done), level=messages.SUCCESS)

    action.__name__ = "action_" + "".join(c if c.isalnum() else "_" for c in description.lower())
    return action
