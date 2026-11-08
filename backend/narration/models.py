from django.db import models

from artefacts.models import Artefact


class NarrationStatus(models.TextChoices):
    NONE = "none", "Not recorded"
    GENERATING = "generating", "Generating"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"


class Language(models.TextChoices):
    ENGLISH = "en", "English"
    SWAHILI = "sw", "Swahili"


class Narration(models.Model):
    artefact = models.OneToOneField(Artefact, on_delete=models.CASCADE, related_name="narration")
    story_text = models.TextField(blank=True)
    language = models.CharField(max_length=5, choices=Language.choices, default=Language.ENGLISH)
    voice = models.CharField(max_length=100, blank=True)
    audio_path = models.CharField(max_length=500, blank=True)
    status = models.CharField(
        max_length=20, choices=NarrationStatus.choices, default=NarrationStatus.NONE
    )
    text_hash = models.CharField(max_length=64, blank=True)
    error = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Narration for {self.artefact_id} ({self.status})"
