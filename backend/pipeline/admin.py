"""Django admin for pipeline: our demo screens. Owner: C.

Register: Job (status, Meshy task id, credits, errors; read-only), and a
<model-viewer> preview of the GLB for the demo.

Status fields are never edited by hand. Use core.admin.ProtectedStatusAdminMixin to make
them read-only, and core.admin.service_action() for buttons that call service functions.
"""
from django.contrib import admin  # noqa: F401

from core.admin import ProtectedStatusAdminMixin, service_action  # noqa: F401
