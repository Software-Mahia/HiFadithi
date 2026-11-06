"""API endpoints for pipeline: keep them thin, call services. Owner: C."""
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsResearcher

from .engines.meshy import MeshyError
from .models import Job
from .selectors import get_visible_capture, get_visible_job
from .serializers import JobSerializer, StartJobSerializer
from .services import poll_jobs, refresh_job, start_job

logger = logging.getLogger(__name__)

# The job page asks every few seconds; ask the engine at most this often per job.
REFRESH_EVERY = timedelta(seconds=10)


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
    """GET /api/jobs/{id}/: where a job stands. Also nudges a running job forward."""

    permission_classes = [IsResearcher]

    def get(self, request, job_id):
        job = get_visible_job(request.user, job_id)
        if job.is_active and job.updated_at < timezone.now() - REFRESH_EVERY:
            try:
                job = refresh_job(job)
            except (MeshyError, ImproperlyConfigured) as exc:
                logger.warning("Could not refresh job %s: %s", job.id, exc)
        return Response(JobSerializer(job).data)


class _TokenView(APIView):
    """Called by machines (Meshy, cron-job.org), not people: the secret is in the URL."""

    authentication_classes = []
    permission_classes = [AllowAny]  # the URL token below is the check

    def check_token(self, token):
        expected = settings.MESHY_WEBHOOK_TOKEN
        if not expected or not secrets.compare_digest(token, expected):
            raise NotFound()


class MeshyWebhookView(_TokenView):
    """POST /api/webhooks/meshy/<token>/: Meshy says a task changed.

    Only the task id is taken from the body; the status is fetched from Meshy itself.
    Always answers 200 quickly unless we failed unexpectedly (then Meshy retries).
    """

    def post(self, request, token):
        self.check_token(token)
        task_id = request.data.get("id") if isinstance(request.data, dict) else None
        job = Job.objects.filter(task_id=task_id).first() if task_id else None
        if job is None:
            # Meshy webhooks are account-wide: tasks made elsewhere arrive here too.
            return Response({"status": "ignored"})
        try:
            job = refresh_job(job)
        except MeshyError as exc:
            logger.warning("Webhook could not refresh job %s: %s", job.id, exc)
            return Response({"status": "retry later"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({"status": job.status})


class PollJobsView(_TokenView):
    """GET or POST /api/jobs/poll/<token>/: cron-job.org calls this every 10 minutes."""

    def get(self, request, token):
        self.check_token(token)
        return Response(poll_jobs())

    post = get
