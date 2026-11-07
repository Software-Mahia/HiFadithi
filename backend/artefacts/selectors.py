"""Everything in artefacts that READS (other apps may import these). Owner: B."""
from django.db.models import Q
from rest_framework.exceptions import NotFound

from access.selectors import visible_artefacts

from .models import Artefact, Capture


def get_visible_artefact(user, artefact_id):
    """One artefact the user may see, or a 404. Never look artefacts up without this."""
    try:
        return visible_artefacts(user).get(pk=artefact_id)
    except Artefact.DoesNotExist:
        raise NotFound("Artefact not found.") from None


def list_visible_artefacts(
    user, *, q="", community="", object_type="", status="", model_status=""
):
    """Artefacts the user may see, newest first, optionally searched and filtered.

    status is collection_status (in_collection/withdrawn/...); model_status is the
    ported mobile pipeline status (processing/ready/published/failed).
    """
    queryset = visible_artefacts(user)
    if q:
        queryset = queryset.filter(
            Q(title__icontains=q)
            | Q(nmk_accession_no__icontains=q)
            | Q(community__icontains=q)
            | Q(object_type__icontains=q)
            | Q(materials__icontains=q)
            | Q(description__icontains=q)
        )
    if community:
        queryset = queryset.filter(community__iexact=community)
    if object_type:
        queryset = queryset.filter(object_type__iexact=object_type)
    if status:
        queryset = queryset.filter(collection_status=status)
    if model_status:
        queryset = queryset.filter(status=model_status)
    return queryset.order_by("-created_at", "-id")


def published_artefacts():
    """Guest gallery: pipeline-published, non-restricted artefacts. Ported."""
    from .models import ArtefactStatus

    return Artefact.objects.filter(status=ArtefactStatus.PUBLISHED, restricted=False)


def artefacts_for_user(user):
    """Compat shim for ported MVP code (narration): same visibility rule as
    visible_artefacts() — restricted artefacts need a grant, per BR-12."""
    return visible_artefacts(user)


def get_visible_capture(user, capture_id):
    """One capture of an artefact the user may see, or a 404."""
    try:
        return Capture.objects.filter(artefact__in=visible_artefacts(user)).get(pk=capture_id)
    except Capture.DoesNotExist:
        raise NotFound("Capture not found.") from None