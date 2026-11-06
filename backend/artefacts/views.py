"""API endpoints for artefacts: keep them thin, call services. Owner: B."""
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListCreateAPIView
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsCurator, IsResearcher

from . import selectors, services
from .models import CollectionStatus
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
        if status_value and status_value not in CollectionStatus.values:
            raise ValidationError(
                {"status": f"Unknown status. Use one of: {', '.join(CollectionStatus.values)}."}
            )
        return selectors.list_visible_artefacts(
            self.request.user,
            q=params.get("q", "").strip(),
            community=params.get("community", "").strip(),
            object_type=params.get("object_type", "").strip(),
            status=status_value,
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ArtefactDetailView(APIView):
    """GET /api/artefacts/{artefact_id}/: one artefact the user may see (else 404)."""

    permission_classes = [IsResearcher | IsCurator | IsAdmin]

    def get(self, request, artefact_id):
        artefact = selectors.get_visible_artefact(request.user, artefact_id)
        return Response(ArtefactSerializer(artefact).data)


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