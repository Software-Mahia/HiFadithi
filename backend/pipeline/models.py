"""Models for pipeline. Owner: C.

Job: one request to the 3D engine (FakeEngine or Meshy) to build a model from a capture.
"""
import uuid

from django.conf import settings
from django.db import models


class Job(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"          # saved, not yet accepted by the engine
        RUNNING = "running", "Running"       # the engine has a task id and is working
        SUCCEEDED = "succeeded", "Succeeded"
        FAILED = "failed", "Failed"

    ACTIVE = (Status.QUEUED, Status.RUNNING)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    model_version = models.ForeignKey(
        "workflow.ModelVersion", null=True, blank=True, on_delete=models.PROTECT,
        related_name="jobs",
    )
    capture = models.ForeignKey(
        "artefacts.Capture", null=True, blank=True, on_delete=models.PROTECT,
        related_name="jobs",
    )
    # Ported mobile fast flow: the job hangs off the artefact directly, using the
    # app's slot-by-slot images; no Capture row and no ModelVersion review gates.
    artefact = models.ForeignKey(
        "artefacts.Artefact", null=True, blank=True, on_delete=models.CASCADE,
        related_name="pipeline_jobs",
    )
    engine = models.CharField(max_length=20)  # "fake" or "meshy"
    ai_model = models.CharField(max_length=40, blank=True)  # e.g. meshy-6-lite
    task_id = models.CharField(max_length=100, null=True, blank=True, unique=True)

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    progress = models.PositiveSmallIntegerField(default=0)
    credits_used = models.PositiveIntegerField(null=True, blank=True)
    error = models.TextField(blank=True)

    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status"])]

    def __str__(self):
        return f"Job {self.id} ({self.engine}, {self.status})"

    @property
    def is_active(self):
        return self.status in self.ACTIVE
