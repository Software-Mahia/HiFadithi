"""Django admin for access: our demo screens. Owner: A.

Register: ArtefactAccess: list who can see each restricted artefact.

Status fields are never edited by hand. Use core.admin.ProtectedStatusAdminMixin to make
them read-only, and core.admin.service_action() for buttons that call service functions.
"""
from django.contrib import admin  # noqa: F401

from core.admin import ProtectedStatusAdminMixin, service_action  # noqa: F401
