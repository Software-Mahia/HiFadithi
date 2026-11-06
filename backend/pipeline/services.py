"""Everything in pipeline that WRITES. Owner: C.

start_job(): turn a complete capture into a new ModelVersion and a 3D task.
"""
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import APIException

from artefacts.models import VIEW_KEYS
from core.storage import CAPTURES_BUCKET, signed_download_url
from workflow.models import ModelVersion
from workflow.services import create_version, transition_model

from .engines import get_engine
from .engines.meshy import MeshyError
from .models import Job

# Meshy fetches the photos when the task starts, but a task can wait in Meshy's queue.
# Links are made fresh on every start and never reused.
PHOTO_LINK_SECONDS = 6 * 60 * 60

# What one task costs, to check the monthly limit before spending. Failed tasks are refunded.
CREDITS_PER_TASK = {"meshy-6-lite": 15, "meshy-7.1": 30}
DEFAULT_CREDITS_PER_TASK = 30


class CaptureIncomplete(APIException):
    status_code = 400
    default_code = "capture_incomplete"
    default_detail = "All four photos must be uploaded before a 3D model can be made."


class JobAlreadyRunning(APIException):
    status_code = 409
    default_code = "job_already_running"
    default_detail = "A 3D model is already being made for this artefact."


class CreditLimitReached(APIException):
    status_code = 409
    default_code = "credit_limit_reached"
    default_detail = "This month's Meshy credit limit has been reached."


class EngineUnavailable(APIException):
    status_code = 502
    default_code = "engine_unavailable"
    default_detail = "The 3D service could not start the job. Try again later."


def start_job(*, capture, user):
    """Create version n+1 (Processing) and a Job, then submit the 4 photos to the engine.

    If the engine refuses, the Job and version are kept as Failed (so the history is
    visible) and EngineUnavailable is raised.
    """
    if not capture.upload_complete or any(not capture.views.get(v) for v in VIEW_KEYS):
        raise CaptureIncomplete()

    engine_name = settings.ENGINE
    ai_model = settings.MESHY_AI_MODEL if engine_name == "meshy" else ""

    with transaction.atomic():
        # Lock the artefact so two clicks can't start two jobs.
        artefact = type(capture.artefact).objects.select_for_update().get(pk=capture.artefact_id)
        if Job.objects.filter(model_version__artefact=artefact, status__in=Job.ACTIVE).exists():
            raise JobAlreadyRunning()
        if engine_name == "meshy":
            _check_credit_limit(ai_model)

        version = create_version(artefact, f"AI-assisted 3D model from capture {capture.id}", user)
        transition_model(version, ModelVersion.Status.PROCESSING, reason="3D job started",
                         actor=user)
        job = Job.objects.create(
            model_version=version, capture=capture, engine=engine_name,
            ai_model=ai_model, started_by=user,
        )

    # Outside the transaction: the job is saved even if the engine call fails.
    try:
        engine = get_engine()
        task_id = engine.submit(photo_urls(capture, engine_name))
    except (MeshyError, ImproperlyConfigured, ValueError) as exc:
        mark_failed(job, str(exc))
        raise EngineUnavailable(f"The 3D service could not start the job: {exc}") from exc

    job.task_id = task_id
    job.status = Job.Status.RUNNING
    job.save(update_fields=["task_id", "status", "updated_at"])
    return job


def photo_urls(capture, engine_name):
    """Fresh download links for front, back, left, right (in that order: front first)."""
    keys = [capture.views[view] for view in VIEW_KEYS]
    try:
        return [
            signed_download_url(CAPTURES_BUCKET, k, expires_in=PHOTO_LINK_SECONDS) for k in keys
        ]
    except ImproperlyConfigured:
        if engine_name != "fake":
            raise
        # Laptop without Supabase keys: FakeEngine never downloads, any link will do.
        return [f"local://{CAPTURES_BUCKET}/{k}" for k in keys]


def mark_failed(job, error):
    """Record a failed job and move its version to Failed. Safe to call twice."""
    job.status = Job.Status.FAILED
    job.error = (error or "Unknown error")[:1000]
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "error", "finished_at", "updated_at"])
    if job.model_version.review_status != ModelVersion.Status.FAILED:
        transition_model(job.model_version, ModelVersion.Status.FAILED, reason=job.error)


def _check_credit_limit(ai_model):
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    this_month = Job.objects.filter(engine="meshy", created_at__gte=month_start).exclude(
        status=Job.Status.FAILED  # failed tasks are refunded
    )
    spent = this_month.filter(credits_used__isnull=False).aggregate(s=Sum("credits_used"))["s"] or 0
    pending = sum(
        CREDITS_PER_TASK.get(m, DEFAULT_CREDITS_PER_TASK)
        for m in this_month.filter(credits_used__isnull=True).values_list("ai_model", flat=True)
    )
    cost = CREDITS_PER_TASK.get(ai_model, DEFAULT_CREDITS_PER_TASK)
    if spent + pending + cost > settings.MESHY_MONTHLY_CREDIT_LIMIT:
        raise CreditLimitReached(
            f"This month's Meshy credit limit ({settings.MESHY_MONTHLY_CREDIT_LIMIT}) "
            f"would be passed: {spent + pending} used or reserved, this job needs {cost}."
        )
