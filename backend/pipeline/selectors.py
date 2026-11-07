"""Everything in pipeline that READS (other apps may import these). Owner: C."""
from django.db.models import Q
from rest_framework.exceptions import NotFound

from access.selectors import visible_artefacts
from artefacts.models import Capture

from .models import Job


def get_visible_capture(user, capture_id):
    try:
        return Capture.objects.filter(artefact__in=visible_artefacts(user)).get(pk=capture_id)
    except (Capture.DoesNotExist, ValueError):
        raise NotFound("Capture not found.") from None


def get_visible_job(user, job_id):
    jobs = (
        Job.objects.select_related("model_version", "capture", "artefact")
        .filter(
            Q(model_version__artefact__in=visible_artefacts(user))
            | Q(artefact__in=visible_artefacts(user))
        )
    )
    try:
        return jobs.get(pk=job_id)
    except (Job.DoesNotExist, ValueError):
        raise NotFound("Job not found.") from None
