"""API input and output shapes for pipeline. Owner: C."""
from rest_framework import serializers

from .models import Job


class StartJobSerializer(serializers.Serializer):
    capture_id = serializers.UUIDField()


class JobSerializer(serializers.ModelSerializer):
    artefact_id = serializers.UUIDField(source="model_version.artefact_id", read_only=True)
    version = serializers.IntegerField(source="model_version.version", read_only=True)
    review_status = serializers.CharField(source="model_version.review_status", read_only=True)

    class Meta:
        model = Job
        fields = [
            "id", "artefact_id", "capture", "model_version", "version", "review_status",
            "engine", "status", "progress", "error", "created_at", "finished_at",
        ]
        read_only_fields = fields
