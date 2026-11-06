"""Models for artefacts. Owner: B.

Artefact, Capture, Hotspot, search; copy_hotspots() after day 6; seed_demo command.
"""
import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone

# Seam S5 (B -> C): a capture holds these four views, each a storage path
# such as captures/{artefact_id}/{capture_id}/front.jpg
VIEW_KEYS = ["front", "back", "left", "right"]


class CollectionStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    IN_COLLECTION = "in_collection", "In collection"
    WITHDRAWN = "withdrawn", "Withdrawn"


class Artefact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nmk_accession_no = models.CharField(max_length=100, unique=True)
    title = models.CharField(max_length=255)
    community = models.CharField(max_length=120, blank=True)
    object_type = models.CharField(max_length=120, blank=True)
    materials = models.TextField(blank=True)

    # Millimetres. Nullable: a Draft may not have them yet. C's start-job needs height_mm.
    height_mm = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    width_mm = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    depth_mm = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)
    extra_dimensions = models.JSONField(default=dict, blank=True)

    cultural_protocols = models.TextField(blank=True)
    restricted = models.BooleanField(default=False)

    # Changed ONLY by transition_model() (workflow app). editable=False keeps it out of
    # admin forms and serializers, so nothing writes it by accident.
    collection_status = models.CharField(
        max_length=20,
        choices=CollectionStatus.choices,
        default=CollectionStatus.DRAFT,
        editable=False,
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["community"]),
            models.Index(fields=["object_type"]),
            models.Index(fields=["collection_status"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(height_mm__gt=0), name="artefact_height_positive"),
            models.CheckConstraint(condition=Q(width_mm__gt=0), name="artefact_width_positive"),
            models.CheckConstraint(condition=Q(depth_mm__gt=0), name="artefact_depth_positive"),
        ]

    def __str__(self):
        return f"{self.nmk_accession_no}: {self.title}"


class Capture(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    artefact = models.ForeignKey(Artefact, on_delete=models.CASCADE, related_name="captures")
    kind = models.CharField(
        max_length=20, choices=[("four_photos", "Four photos")], default="four_photos"
    )
    # {"front": "<storage path>", "back": ..., "left": ..., "right": ...}
    views = models.JSONField(default=dict, blank=True)
    captured_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    captured_at = models.DateTimeField(default=timezone.now)
    upload_complete = models.BooleanField(default=False)

    class Meta:
        ordering = ["-captured_at"]
        constraints = [
            # A capture cannot be marked complete unless all four views are present.
            models.CheckConstraint(
                condition=Q(upload_complete=False) | Q(views__has_keys=VIEW_KEYS),
                name="capture_four_views_when_complete",
            ),
        ]

    def __str__(self):
        return f"Capture {self.id} of {self.artefact_id}"
