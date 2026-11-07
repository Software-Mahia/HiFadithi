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


class ArtefactStatus(models.TextChoices):
    """Pipeline status of the 3D work (ported from the hifadithi MVP's fast flow).
    Owned by the app services; unlike collection_status this is NOT workflow-guarded."""

    DRAFT = "draft", "Draft"
    PROCESSING = "processing", "Processing"
    READY = "ready", "Ready"
    PUBLISHED = "published", "Published"
    FAILED = "failed", "Failed"


class ImageSlot(models.TextChoices):
    FRONT = "front", "Front"
    BACK = "back", "Back"
    LEFT = "left", "Left"
    RIGHT = "right", "Right"


SLOT_ORDER = {ImageSlot.FRONT: 0, ImageSlot.BACK: 1, ImageSlot.LEFT: 2, ImageSlot.RIGHT: 3}


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

    # Museum-card fields (ported from the hifadithi MVP; the app's OCR scan and
    # detail screen use these). material is singular here; materials stays as-is.
    description = models.TextField(blank=True)
    material = models.CharField(max_length=255, blank=True)
    dimensions = models.CharField(max_length=255, blank=True)
    date_or_period = models.CharField(max_length=255, blank=True)
    provenance = models.TextField(blank=True)
    donor = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)

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

    # Pipeline status (fast flow: draft -> processing -> ready -> published/failed).
    # editable=False keeps it out of admin forms and B's serializers; only the
    # artefacts service functions write it (see artefacts.services.set_status).
    status = models.CharField(
        max_length=20, choices=ArtefactStatus.choices,
        default=ArtefactStatus.DRAFT, editable=False,
    )
    published_at = models.DateTimeField(null=True, blank=True)
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


class ArtefactImage(models.Model):
    """One photo slot for the mobile app's flow (ported from the hifadithi MVP).

    Capture (above) is slice C's all-four-at-once flow; the app uploads slot by
    slot instead, so each slot is its own row with a unique path per artefact.
    """

    artefact = models.ForeignKey(Artefact, on_delete=models.CASCADE, related_name="images")
    slot = models.CharField(max_length=10, choices=ImageSlot.choices)
    storage_path = models.CharField(max_length=500)
    content_type = models.CharField(max_length=100, default="image/jpeg")
    size_bytes = models.PositiveBigIntegerField(null=True, blank=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "slot"]
        constraints = [
            models.UniqueConstraint(
                fields=["artefact", "slot"], name="unique_image_slot_per_artefact"
            )
        ]

    def save(self, *args, **kwargs):
        self.order = SLOT_ORDER.get(self.slot, 99)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.artefact_id} {self.slot}"


class Model3D(models.Model):
    artefact = models.OneToOneField(Artefact, on_delete=models.CASCADE, related_name="model3d")
    glb_path = models.CharField(max_length=500)
    scale_factor = models.FloatField(default=1.0)
    size_bytes = models.PositiveBigIntegerField(null=True, blank=True)
    triangles = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Model3D for {self.artefact_id}"


class PublishedArtefactQuerySet(models.QuerySet):
    def published(self):
        return self.filter(status=ArtefactStatus.PUBLISHED)
