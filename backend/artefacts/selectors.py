"""Everything in artefacts that READS (other apps may import these). Owner: B."""
from rest_framework.exceptions import NotFound

from access.selectors import visible_artefacts

from .models import Artefact, Capture


def get_visible_artefact(user, artefact_id):
    """One artefact the user may see, or a 404. Never look artefacts up without this."""
    try:
        return visible_artefacts(user).get(pk=artefact_id)
    except Artefact.DoesNotExist:
        raise NotFound("Artefact not found.") from None


def get_visible_capture(user, capture_id):
    """One capture of an artefact the user may see, or a 404."""
    try:
        return Capture.objects.filter(artefact__in=visible_artefacts(user)).get(pk=capture_id)
    except Capture.DoesNotExist:
        raise NotFound("Capture not found.") from None