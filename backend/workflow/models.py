"""Models for workflow. Owner: D.

ModelVersion, create_version(), transition_model(), Verification, Approval, check_tolerance().
"""
from django.conf import settings
from django.db import models

from .guard import ProtectedFieldsMixin


class ModelVersion(ProtectedFieldsMixin, models.Model):
    """One record of an artefact, from draft through verification and approval."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PROCESSING = "processing", "Processing"
        NEEDS_VERIFICATION = "needs_verification", "Needs verification"
        VERIFIED = "verified", "Verified"
        APPROVED = "approved", "Approved"
        SUPERSEDED = "superseded", "Superseded"
        WITHDRAWN = "withdrawn", "Withdrawn"
        REJECTED = "rejected", "Rejected"
        FAILED = "failed", "Failed"

    PROTECTED_FIELDS = ("review_status", "is_current")

    artefact = models.ForeignKey(
        "artefacts.Artefact",
        on_delete=models.CASCADE,
        related_name="versions",
    )
    version = models.PositiveIntegerField()
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children",
    )
    change_note = models.TextField(blank=True)
    glb_path = models.CharField(max_length=500, blank=True)
    poster_path = models.CharField(max_length=500, blank=True)
    size_bytes = models.BigIntegerField(null=True, blank=True)
    triangles = models.PositiveIntegerField(null=True, blank=True)
    scale_factor = models.FloatField(default=1.0)
    bbox_width_mm = models.FloatField(null=True, blank=True)
    bbox_depth_mm = models.FloatField(null=True, blank=True)
    review_status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.DRAFT,
    )
    is_current = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_model_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("artefact", "-version")
        constraints = [
            models.UniqueConstraint(
                fields=("artefact", "version"),
                name="unique_model_version_per_artefact",
            )
        ]

    def __str__(self):
        return f"Artefact {self.artefact_id} v{self.version} ({self.get_review_status_display()})"
