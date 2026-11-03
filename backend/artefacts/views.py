"""API endpoints for artefacts: keep them thin, call services. Owner: B."""
from rest_framework import status
from rest_framework.generics import CreateAPIView
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsResearcher

from . import selectors, services
from .serializers import ArtefactSerializer


class ArtefactCreateView(CreateAPIView):
    """POST /api/artefacts/: researchers create a record (starts as a Draft)."""

    permission_classes = [IsResearcher]
    serializer_class = ArtefactSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


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