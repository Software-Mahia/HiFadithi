"""API input and output shapes for pipeline. Owner: C (mobile payload ported)."""
from rest_framework import serializers

from .models import Job


class StartJobSerializer(serializers.Serializer):
    capture_id = serializers.UUIDField()


class JobSerializer(serializers.ModelSerializer):
    artefact_id = serializers.SerializerMethodField()
    version = serializers.IntegerField(source="model_version.version", read_only=True)
    review_status = serializers.CharField(source="model_version.review_status", read_only=True)

    class Meta:
        model = Job
        fields = [
            "id", "artefact_id", "capture", "model_version", "version", "review_status",
            "engine", "status", "progress", "error", "created_at", "finished_at",
        ]
        read_only_fields = fields

    def get_artefact_id(self, job):
        if job.artefact_id:
            return job.artefact_id
        if job.model_version is not None:
            return job.model_version.artefact_id
        return None


class MobileJobSerializer(JobSerializer):
    """Payload the ported mobile app polls: C's fields plus the app's extras
    (status_label, credits_used, attempts, started_at). Superset so both
    consumer styles keep working."""

    status_label = serializers.CharField(source="get_status_display", read_only=True)
    attempts = serializers.SerializerMethodField()
    started_at = serializers.SerializerMethodField()

    class Meta(JobSerializer.Meta):
        fields = [
            "id", "artefact_id", "capture", "model_version", "version", "review_status",
            "engine", "status", "status_label", "progress", "error", "attempts",
            "credits_used", "created_at", "started_at", "finished_at",
        ]

    def get_attempts(self, job):
        return 0  # no retry counter on this model; kept for app payload parity

    def get_started_at(self, job):
        return None  # the engine "start" time is not tracked; app shows created/finished
