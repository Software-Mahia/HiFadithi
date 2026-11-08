from rest_framework import serializers

from .models import Narration, NarrationStatus


class NarrationWriteSerializer(serializers.Serializer):
    story_text = serializers.CharField(
        required=False, allow_blank=True, max_length=3000, trim_whitespace=True
    )
    language = serializers.ChoiceField(choices=["en", "sw"], default="en")


class NarrationSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Narration
        fields = (
            "story_text",
            "language",
            "voice",
            "status",
            "status_label",
            "error",
            "audio_url",
            "updated_at",
        )

    def get_audio_url(self, obj):
        from core import storage
        from core.storage import NARRATION_BUCKET

        if not obj.audio_path or obj.status != NarrationStatus.READY:
            return None
        return storage.signed_download_url(NARRATION_BUCKET, obj.audio_path)
