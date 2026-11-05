"""Django admin for access: our demo screens. Owner: A.

Register: ArtefactAccess: list who can see each restricted artefact.

Status fields are never edited by hand. Use core.admin.ProtectedStatusAdminMixin to make
them read-only, and core.admin.service_action() for buttons that call service functions.
"""
from django.contrib import admin

from core.admin import ProtectedStatusAdminMixin, service_action  # noqa: F401

from .models import ArtefactAccess


@admin.register(ArtefactAccess)
class ArtefactAccessAdmin(admin.ModelAdmin):
    list_display = ("artefact", "user", "role", "granted_by", "granted_at")
    list_filter = ("role",)
    search_fields = ("artefact__nmk_accession_no", "user__username")
    readonly_fields = ("granted_at",)
