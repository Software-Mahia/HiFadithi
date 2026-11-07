"""Everything in pipeline that WRITES. Owner: C.

start_job():   turn a complete capture into a new ModelVersion and a 3D task.
refresh_job(): ask the engine where a task stands and record it. The Meshy webhook, the
               poll endpoint (cron-job.org, every 10 min) and the job page all use it.
poll_jobs():   refresh every running job and fail the ones stuck for too long.
"""
import logging
from contextlib import suppress
from datetime import timedelta
from urllib.parse import urlparse

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework.exceptions import APIException

from artefacts.models import VIEW_KEYS
from core.storage import CAPTURES_BUCKET, signed_download_url
from workflow.models import ModelVersion
from workflow.services import create_version, transition_model

from .engines import get_engine
from .engines.meshy import MeshyError
from .model_files import ModelCopyError, copy_model, fill_model_version, model_path
from .models import Job

logger = logging.getLogger(__name__)

# A job with no answer after this long is failed, so it never blocks the artefact forever.
JOB_TIMEOUT = timedelta(minutes=30)
# A job that never got a task id (the server stopped mid-start) is failed after this long.
SUBMIT_TIMEOUT = timedelta(minutes=5)
POLL_BATCH = 10  # jobs per poll call: keeps one call well inside cron-job.org's time limit
# Meshy hands out model files from its own asset host (e.g. https://assets.meshy.ai/...).
MESHY_MODEL_HOST_SUFFIX = ".meshy.ai"

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


def refresh_job(job):
    """Ask the engine for the task's status and record it. Returns the job, reloaded.

    Never trusts a webhook body: the status always comes from the engine itself, so a
    forged, repeated or out-of-order call can't change anything wrongly.
    """
    if not job.is_active or not job.task_id:
        return job
    task = get_engine(job.engine).get_status(job.task_id)
    return apply_task_status(job, task)


def apply_task_status(job, task):
    """Record one TaskStatus on the job. Safe to call twice and in any order."""
    with transaction.atomic():
        # Lock the row: a webhook and a poll arriving together can't both copy the model.
        job = Job.objects.select_for_update().select_related("model_version").get(pk=job.pk)
        if not job.is_active:
            return job  # already finished: ignore repeats and late arrivals

        if task.status in ("PENDING", "IN_PROGRESS"):
            job.status = Job.Status.RUNNING
            job.progress = max(job.progress, min(int(task.progress or 0), 99))
            job.save(update_fields=["status", "progress", "updated_at"])
            return job

        job.credits_used = task.credits_used
        job.save(update_fields=["credits_used", "updated_at"])

        if task.status != "SUCCEEDED":  # FAILED or CANCELED
            mark_failed(job, task.error or f"The 3D task ended as {task.status.lower()}.")
            return job
        if not task.glb_url:
            mark_failed(job, "The 3D task finished without a model file.")
            return job

        if not model_url_allowed(task.glb_url, job.engine):
            mark_failed(job, "The 3D task's model link is not from the 3D service.")
            return job

        version = job.model_version
        if not version:
            return _finish_job_artefact_fast_flow(job, task)
        try:
            stored = copy_model(
                task.glb_url,
                model_path(version.artefact_id, version.version),
                allowed=lambda url: model_url_allowed(url, job.engine),  # every redirect too
            )
        except ModelCopyError as exc:
            mark_failed(job, str(exc))
            return job
        fill_model_version(version, stored)

        job.status = Job.Status.SUCCEEDED
        job.progress = 100
        job.finished_at = timezone.now()
        job.save(update_fields=["status", "progress", "finished_at", "updated_at"])
        transition_model(version, ModelVersion.Status.NEEDS_VERIFICATION, reason="3D model ready")
        return job


def _finish_job_artefact_fast_flow(job, task):
    """Ported fast-flow success path (mobile app): no Capture row and no
    ModelVersion review gates. The GLB is copied into the models bucket, written
    onto the artefact's Model3D row, and the artefact becomes ready."""
    from artefacts.services import mark_failed as artefact_mark_failed
    from artefacts.services import mark_ready, replace_current_model

    artefact = job.artefact
    try:
        stored = copy_model(
            task.glb_url,
            f"{artefact.id}/model.glb",
            allowed=lambda url: model_url_allowed(url, job.engine),
        )
    except ModelCopyError as exc:
        mark_failed(job, str(exc))
        if artefact:
            artefact_mark_failed(artefact)
        return job

    replace_current_model(artefact, glb_path=stored.path, size_bytes=stored.info.size_bytes)
    mark_ready(artefact)
    job.status = Job.Status.SUCCEEDED
    job.progress = 100
    job.finished_at = timezone.now()
    job.save(update_fields=["status", "progress", "finished_at", "credits_used", "updated_at"])
    return job


# --- ported from the hifadithi MVP: artefact-slot jobs (mobile fast flow) -----


def photo_urls_for_artefact(artefact, engine_name):
    """Fresh download links for the app's four slot images, in VIEW_KEYS order."""
    keys = []
    for view in VIEW_KEYS:
        image = artefact.images.filter(slot=view).first()
        if image is None:
            raise CaptureIncomplete()
        keys.append(image.storage_path)
    try:
        return [
            signed_download_url(CAPTURES_BUCKET, k, expires_in=PHOTO_LINK_SECONDS) for k in keys
        ]
    except ImproperlyConfigured:
        if engine_name != "fake":
            raise
        # Laptop without Supabase keys: FakeEngine never downloads, any link will do.
        return [f"local://{CAPTURES_BUCKET}/{k}" for k in keys]


def start_job_for_artefact(*, artefact, user):
    """Ported entry point: turn the app's four slot images + height into a 3D job.

    Same engine plumbing as start_job(), but the artefact keeps its fast-flow
    status (draft -> processing -> ready/failed via artefacts.services) instead
    of the review-gated ModelVersion pipeline.
    """
    from artefacts.services import mark_processing, validate_generation_ready

    validate_generation_ready(artefact)

    engine_name = settings.ENGINE
    ai_model = settings.MESHY_AI_MODEL if engine_name == "meshy" else ""

    with transaction.atomic():
        locked = type(artefact).objects.select_for_update().get(pk=artefact.pk)
        if Job.objects.filter(
            Q(artefact=locked) | Q(model_version__artefact=locked),
            status__in=Job.ACTIVE,
        ).exists():
            raise JobAlreadyRunning()
        if engine_name == "meshy":
            _check_credit_limit(ai_model)
        job = Job.objects.create(
            artefact=locked, engine=engine_name, ai_model=ai_model, started_by=user
        )

    mark_processing(locked)

    # Outside the transaction: the job is saved even if the engine call fails.
    try:
        engine = get_engine()
        task_id = engine.submit(photo_urls_for_artefact(locked, engine_name))
    except (MeshyError, ImproperlyConfigured, ValueError) as exc:
        mark_failed(job, str(exc))
        with suppress(Exception):
            from artefacts.services import mark_failed as artefact_mark_failed

            artefact_mark_failed(locked)
        raise EngineUnavailable(f"The 3D service could not start the job: {exc}") from exc

    job.task_id = task_id
    job.status = Job.Status.RUNNING
    job.save(update_fields=["task_id", "status", "updated_at"])
    return job


def model_url_allowed(url, engine_name):
    """Only download models over https from the engine's own host.

    Meshy: any *.meshy.ai host. FakeEngine: the host of FAKE_ENGINE_GLB_URL (our samples
    bucket). Anything else is refused, so a bad status can never make us fetch another URL.
    """
    parsed = urlparse(url or "")
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host:
        return False
    if engine_name == "meshy":
        return host == MESHY_MODEL_HOST_SUFFIX[1:] or host.endswith(MESHY_MODEL_HOST_SUFFIX)
    fake_host = urlparse(getattr(settings, "FAKE_ENGINE_GLB_URL", "") or "").hostname
    return bool(fake_host) and host == fake_host.lower()


def poll_jobs(now=None):
    """Refresh running jobs and fail stuck ones. Returns counts for the cron log."""
    now = now or timezone.now()
    counts = {"checked": 0, "succeeded": 0, "failed": 0, "errors": 0}

    for job in Job.objects.filter(status=Job.Status.QUEUED, created_at__lt=now - SUBMIT_TIMEOUT):
        mark_failed(job, "The job was never accepted by the 3D service.")
        counts["failed"] += 1

    running = Job.objects.filter(status=Job.Status.RUNNING).order_by("updated_at")[:POLL_BATCH]
    for job in running:
        if job.created_at < now - JOB_TIMEOUT:
            mark_failed(job, "The 3D service took longer than 30 minutes.")
            counts["failed"] += 1
            continue
        counts["checked"] += 1
        try:
            job = refresh_job(job)
        except (MeshyError, ImproperlyConfigured) as exc:
            # Meshy down for a moment: leave the job running, try again next time.
            logger.warning("Could not refresh job %s: %s", job.id, exc)
            counts["errors"] += 1
            continue
        if job.status == Job.Status.SUCCEEDED:
            counts["succeeded"] += 1
        elif job.status == Job.Status.FAILED:
            counts["failed"] += 1
    return counts
