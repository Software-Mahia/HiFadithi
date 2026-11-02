"""Django admin for workflow: our demo screens. Owner: D.

Register: ModelVersion (review_status and is_current read-only) with actions
Verify / Approve / Withdraw / Send back that call transition_model() and
check_tolerance(); Verification; Approval.

Status fields are never edited by hand. Use core.admin.ProtectedStatusAdminMixin to make
them read-only, and core.admin.service_action() for buttons that call service functions.
"""
from django.contrib import admin  # noqa: F401

from core.admin import ProtectedStatusAdminMixin, service_action  # noqa: F401
