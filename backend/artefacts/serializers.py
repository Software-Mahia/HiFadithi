"""API input and output shapes for artefacts. Owner: B."""
from decimal import Decimal

from rest_framework import serializers

from .models import Artefact

# The database requires dimensions above zero; millimetres have one decimal place.
_MIN_DIMENSION = {"min_value": Decimal("0.1")}


class ArtefactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Artefact
        fields = [
            "id", "nmk_accession_no", "title", "community", "object_type", "materials",
            "height_mm", "width_mm", "depth_mm", "extra_dimensions",
            "cultural_protocols", "restricted", "collection_status",
            "created_at", "updated_at",
        ]
        # collection_status changes only through transition_model(), never through this API.
        read_only_fields = ["id", "collection_status", "created_at", "updated_at"]
        extra_kwargs = {
            "height_mm": _MIN_DIMENSION,
            "width_mm": _MIN_DIMENSION,
            "depth_mm": _MIN_DIMENSION,
        }