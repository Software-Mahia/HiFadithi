from django.contrib import admin

from .models import Narration


@admin.register(Narration)
class NarrationAdmin(admin.ModelAdmin):
    list_display = ("artefact", "language", "status", "voice", "updated_at")
    list_filter = ("status", "language")
    readonly_fields = ("text_hash", "audio_path", "error", "updated_at")
