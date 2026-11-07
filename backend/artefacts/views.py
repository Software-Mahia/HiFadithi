"""API endpoints for artefacts: keep them thin, call services. Owner: B."""
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsCurator, IsResearcher

from . import selectors, services
from .models import ArtefactStatus, CollectionStatus
from .serializers import ArtefactSerializer


class ArtefactPagination(LimitOffsetPagination):
    default_limit = 20
    max_limit = 100


class ArtefactListCreateView(ListCreateAPIView):
    """GET /api/artefacts/: search and list. POST /api/artefacts/: create a Draft record."""

    serializer_class = ArtefactSerializer
    pagination_class = ArtefactPagination

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsResearcher()]
        return [(IsResearcher | IsCurator | IsAdmin)()]

    def get_queryset(self):
        params = self.request.query_params
        status_value = params.get("status", "")
        allowed = set(CollectionStatus.values) | set(ArtefactStatus.values)
        if status_value and status_value not in allowed:
            raise ValidationError(
                {"status": "Unknown status. Use one of: " + ", ".join(sorted(allowed))}
            )
        # Legacy values filter collection_status; pipeline values (processing/ready/
        # published/failed) filter the ported fast-flow status field.
        collection_status = status_value if status_value in CollectionStatus.values else ""
        model_status = (
            status_value if status_value and status_value not in CollectionStatus.values else ""
        )
        return selectors.list_visible_artefacts(
            self.request.user,
            q=params.get("q", "").strip(),
            community=params.get("community", "").strip(),
            object_type=params.get("object_type", "").strip(),
            status=collection_status,
            model_status=model_status,
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ArtefactDetailView(APIView):
    """GET/PATCH/DELETE /api/artefacts/{artefact_id}/: one artefact the user may see."""

    permission_classes = [IsResearcher | IsCurator | IsAdmin]

    def get(self, request, artefact_id):
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        return Response(ArtefactSerializer(artefact).data)

    def patch(self, request, artefact_id):
        # Ported: the app's artefact editor updates fields in place.
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        serializer = ArtefactSerializer(artefact, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        artefact = services.update_artefact(artefact, **serializer.validated_data)
        return Response(ArtefactSerializer(artefact).data)

    def delete(self, request, artefact_id):
        # Ported: cleanup of rows and stored files, then the row itself.
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        services.delete_artefact(artefact)
        return Response(status=status.HTTP_204_NO_CONTENT)


class StartCaptureView(APIView):
    """POST /api/artefacts/{artefact_id}/captures/: new capture plus four upload links."""

    permission_classes = [IsResearcher]

    def post(self, request, artefact_id):
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        capture, upload_urls = services.start_capture(artefact=artefact, user=request.user)
        return Response(
            {
                "id": str(capture.id),
                "upload_complete": capture.upload_complete,
                "expires_in": services.UPLOAD_LINK_SECONDS,
                "upload_urls": upload_urls,
            },
            status=status.HTTP_201_CREATED,
        )


class CompleteCaptureView(APIView):
    """POST /api/artefacts/captures/{capture_id}/complete/: check all four photos arrived."""

    permission_classes = [IsResearcher]

    def post(self, request, capture_id):
        capture = selectors.get_visible_capture(request.user, capture_id)
        capture = services.complete_capture(capture=capture)
        return Response(
            {
                "id": str(capture.id),
                "upload_complete": capture.upload_complete,
                "views": capture.views,
            }
        )


# --- ported from the hifadithi MVP: images (slot by slot), publish, public ---

import logging  # noqa: E402

from django.conf import settings  # noqa: E402
from django.db.models import Q  # noqa: E402
from django.http import StreamingHttpResponse  # noqa: E402
from rest_framework.parsers import FormParser, MultiPartParser  # noqa: E402
from rest_framework.permissions import AllowAny  # noqa: E402

from core import storage  # noqa: E402
from core.storage import CAPTURES_BUCKET  # noqa: E402

from .models import Artefact  # noqa: E402
from .serializers import (  # noqa: E402
    ArtefactImageSerializer,
    ArtefactSerializer,
    ConfirmImageSerializer,
    PresignImageSerializer,
)

logger = logging.getLogger(__name__)


class PresignImageView(APIView):
    """POST /api/artefacts/{id}/images/presign/: presigned PUT (or direct fallback)."""

    permission_classes = [IsResearcher]

    def post(self, request, artefact_id):
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        serializer = PresignImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        slot = serializer.validated_data["slot"]
        content_type = serializer.validated_data["content_type"]
        extension = storage.extension_for(content_type)
        path = f"{artefact.id}/{slot}.{extension}"
        upload_url = storage.signed_upload_url(CAPTURES_BUCKET, path, content_type)
        return Response(
            {
                "slot": slot,
                "strategy": storage.upload_strategy(),
                "path": path,
                "upload_url": upload_url,
                "method": "PUT" if upload_url else "POST",
                "headers": {"Content-Type": content_type} if upload_url else {},
                "expires_in": 3600,
            }
        )


class ImageUploadView(APIView):
    """POST /api/artefacts/{id}/images/: multipart upload when nothing is presigned."""

    permission_classes = [IsResearcher]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, artefact_id):
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        slot = request.data.get("slot")
        upload = request.FILES.get("file")
        if not upload:
            return Response(
                {"error": {"code": "file_required", "message": "Attach a photo."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload.size > settings.MAX_IMAGE_BYTES:
            return Response(
                {"error": {"code": "file_too_large", "message": "Photo is larger than 10 MB."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            image = services.save_image(
                artefact,
                slot=slot,
                upload=upload,
                content_type=upload.content_type,
                size_bytes=upload.size,
            )
        except ValueError as exc:
            return Response(
                {"error": {"code": "bad_image", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(ArtefactImageSerializer(image).data, status=status.HTTP_201_CREATED)


class ConfirmImageView(APIView):
    """POST /api/artefacts/{id}/images/confirm/: record a slot uploaded to a presigned PUT."""

    permission_classes = [IsResearcher]

    def post(self, request, artefact_id):
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        serializer = ConfirmImageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            image = services.confirm_image(artefact, **serializer.validated_data)
        except ValueError as exc:
            return Response(
                {"error": {"code": "bad_image", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(ArtefactImageSerializer(image).data, status=status.HTTP_201_CREATED)


class PublishView(APIView):
    """POST /api/artefacts/{id}/publish/: READY -> PUBLISHED (fast flow)."""

    permission_classes = [IsResearcher]

    def post(self, request, artefact_id):
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        artefact = services.publish(artefact)
        return Response({"id": artefact.id, "status": artefact.status})


class UnpublishView(APIView):
    """POST /api/artefacts/{id}/unpublish/: PUBLISHED -> READY (fast flow)."""

    permission_classes = [IsResearcher]

    def post(self, request, artefact_id):
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        artefact = services.unpublish(artefact)
        return Response({"id": artefact.id, "status": artefact.status})


def _published_queryset():
    """Guest gallery: published, not restricted (BR-12 leaks nothing publicly)."""
    return Artefact.objects.filter(status=ArtefactStatus.PUBLISHED, restricted=False)


class PublicArtefactModelView(APIView):
    """GET /api/public/artefacts/{id}/model/: stable, cacheable GLB stream."""

    permission_classes = [AllowAny]

    def get(self, request, artefact_id):
        artefact = _published_queryset().filter(pk=artefact_id).first()
        if artefact is None:
            return Response(
                {"error": {"code": "not_found", "message": "Artefact not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        model = getattr(artefact, "model3d", None)
        if model is None:
            return Response(
                {"error": {"code": "not_found", "message": "No 3D model yet."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            body, size, content_type, etag = storage.open_stream(
                storage.MODELS_BUCKET, model.glb_path
            )
        except (FileNotFoundError, RuntimeError):
            return Response(
                {"error": {"code": "not_found", "message": "Model file missing."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        headers = {
            "Content-Type": "model/gltf-binary",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        }
        if size is not None:
            headers["Content-Length"] = str(size)
        if etag:
            headers["ETag"] = f'"{etag}"'
        response = StreamingHttpResponse(streaming_content=body)
        for key, value in headers.items():
            response[key] = value
        response["Content-Disposition"] = 'inline; filename="model.glb"'
        return response


class PublicArtefactListView(APIView):
    """GET /api/public/artefacts/: the guest gallery."""

    permission_classes = [AllowAny]

    def get(self, request):
        queryset = _published_queryset().select_related("model3d", "narration").prefetch_related(
            "images"
        )
        search = request.query_params.get("q", "").strip()
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search)
                | Q(nmk_accession_no__icontains=search)
                | Q(description__icontains=search)
            )
        return Response(ArtefactSerializer(queryset, many=True).data)


class PublicArtefactDetailView(APIView):
    """GET /api/public/artefacts/{id}/: one published artefact."""

    permission_classes = [AllowAny]

    def get(self, request, artefact_id):
        artefact = (
            _published_queryset()
            .select_related("model3d", "narration")
            .prefetch_related("images")
            .filter(pk=artefact_id)
            .first()
        )
        if artefact is None:
            return Response(
                {"error": {"code": "not_found", "message": "Artefact not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(ArtefactSerializer(artefact).data)