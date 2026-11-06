"""API endpoints for pipeline: keep them thin, call services. Owner: C."""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsResearcher

from .selectors import get_visible_capture, get_visible_job
from .serializers import JobSerializer, StartJobSerializer
from .services import start_job


class StartJobView(APIView):
    """POST /api/jobs/ {"capture_id": ...}: make a 3D model from a complete capture."""

    permission_classes = [IsResearcher]

    def post(self, request):
        data = StartJobSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        capture = get_visible_capture(request.user, data.validated_data["capture_id"])
        job = start_job(capture=capture, user=request.user)
        return Response(JobSerializer(job).data, status=status.HTTP_201_CREATED)


class JobDetailView(APIView):
    """GET /api/jobs/{id}/: where a job stands (the page polls this)."""

    permission_classes = [IsResearcher]

    def get(self, request, job_id):
        return Response(JobSerializer(get_visible_job(request.user, job_id)).data)
