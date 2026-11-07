"""API input and output shapes for artefacts. Owner: B (extended by the port).

Two naming sets exist by design:
- The canonical columns (nmk_accession_no, title, materials, ...) — B's original
  contract, still used by the Django admin / capture pipeline tests.
- The app contract (accession_number, name, material, ...) — alias fields that the
  ported mobile app (and the hifadithi MVP flows: OCR pre-fill, story editor)
  write through. Both spellings hit the same columns.
"""
from decimal import Decimal

import rest_framework.serializers as serializers

from core import storage
from core.storage import CAPTURES_BUCKET, MODELS_BUCKET

from .models import Artefact, ArtefactImage, ArtefactStatus, ImageSlot, Model3D

# The database requires dimensions above zero; millimetres have one decimal place.
_MIN_DIMENSION = {"min_value": Decimal("0.1")}


class ArtefactSerializer(serializers.ModelSerializer):
    """Superset output: B's canonical fields + the app contract + nested media."""

    # --- app-contract aliases (write + read) ---
    accession_number = serializers.CharField(source="nmk_accession_no", required=False)
    name = serializers.CharField(source="title", required=False)
    material = serializers.CharField(required=False)

    # --- read-only enrichments (mobile) ---
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    collection_status_label = serializers.CharField(
        source="get_collection_status_display", read_only=True
    )
    cover_image_url = serializers.SerializerMethodField()
    has_model3d = serializers.SerializerMethodField()
    narration_ready = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    model3d = serializers.SerializerMethodField()
    narration = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Artefact
        fields = [
            "id", "nmk_accession_no", "title", "community", "object_type", "materials",
            "height_mm", "width_mm", "depth_mm", "extra_dimensions",
            "cultural_protocols", "restricted", "collection_status",
            "created_at", "updated_at",
            # ported app contract
            "accession_number", "name", "material",
            "description", "dimensions", "date_or_period", "provenance", "donor",
            "location", "status", "status_label", "published_at",
            "cover_image_url", "has_model3d", "narration_ready",
            "images", "model3d", "narration", "created_by_name",
            "collection_status_label",
        ]
        # collection_status AND status change only through services, never through this API.
        read_only_fields = [
            "id", "collection_status", "created_at", "updated_at",
            "status", "published_at",
        ]
        extra_kwargs = {
            "height_mm": _MIN_DIMENSION,
            "width_mm": _MIN_DIMENSION,
            "depth_mm": _MIN_DIMENSION,
        }

    def _cover(self, obj):
        try:
            return next(iter(obj.images.all()), None)
        except Exception:  # images not prefetched, just query
            return obj.images.first()

    def get_cover_image_url(self, obj):
        image = self._cover(obj)
        if image is None:
            return None
        return storage.signed_download_url(CAPTURES_BUCKET, image.storage_path)

    def get_has_model3d(self, obj):
        try:
            return obj.model3d is not None
        except Exception:  # reverse OneToOne without a related row
            return False

    def get_narration_ready(self, obj):
        from narration.models import NarrationStatus

        try:
            narration = obj.narration
        except Exception:
            return False
        return narration.status == NarrationStatus.READY

    def get_images(self, obj):
        return ArtefactImageSerializer(obj.images.all(), many=True).data

    def get_model3d(self, obj):
        try:
            model = obj.model3d
        except Exception:
            return None
        return Model3DSerializer(model).data

    def get_narration(self, obj):
        try:
            narration = obj.narration
        except Exception:
            return None
        from narration.serializers import NarrationSerializer

        return NarrationSerializer(narration).data

    def get_created_by_name(self, obj):
        created_by = obj.created_by
        if created_by is None:
            return None
        return created_by.get_full_name() or created_by.get_username()

    def validate_height_mm(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Height must be greater than zero.")
        return value


def _validate_text_length(value, field, limit=255):
    return value



class ArtefactImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ArtefactImage
        fields = ("slot", "content_type", "size_bytes", "order", "url")

    def get_url(self, obj):
        return storage.signed_download_url(CAPTURES_BUCKET, obj.storage_path)


class Model3DSerializer(serializers.ModelSerializer):
    glb_url = serializers.SerializerMethodField()

    class Meta:
        model = Model3D
        fields = ("glb_url", "scale_factor", "size_bytes", "triangles", "created_at")

    def get_glb_url(self, obj):
        return storage.signed_download_url(MODELS_BUCKET, obj.glb_path)


class PresignImageSerializer(serializers.Serializer):
    slot = serializers.ChoiceField(choices=ImageSlot.values)
    content_type = serializers.ChoiceField(
        choices=["image/jpeg", "image/png", "image/webp"], default="image/jpeg"
    )


class ConfirmImageSerializer(serializers.Serializer):
    slot = serializers.ChoiceField(choices=ImageSlot.values)
    path = serializers.CharField(max_length=500)
    content_type = serializers.ChoiceField(
        choices=["image/jpeg", "image/png", "image/webp"], default="image/jpeg"
    )
    size_bytes = serializers.IntegerField(required=False, min_value=0)


class PublishResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    status = serializers.ChoiceField(choices=ArtefactStatus.choices)
