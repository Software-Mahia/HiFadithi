"""Everything in access that READS. Owner: A."""
from django.db.models import Exists, OuterRef, Q

from artefacts.models import Artefact

from .models import ArtefactAccess


def visible_artefacts(user):
    """Artefacts this user may see (seam used by B's search and D).

    BR-12: a non-restricted artefact is visible to any active staff member. A restricted
    artefact is visible only when an ArtefactAccess row names this user or this user's role.
    An inactive or anonymous user sees nothing. Admin and curator are NOT exempt: restricted
    means restricted, so the leak test holds for every role (see docs/decisions.md).
    """
    if not (user and getattr(user, "is_authenticated", False) and user.is_active):
        return Artefact.objects.none()

    # Match a role grant only when the user has a role. An empty role ("") must never match
    # the role-grant rows: user grants also store role="", so Q(role="") would leak every
    # artefact granted to anyone. User.role is never "" in practice (default + choices), but
    # nothing at the DB level forbids it, so guard here.
    grant_filter = Q(user=user)
    if user.role:
        grant_filter |= Q(role=user.role)
    grant = ArtefactAccess.objects.filter(grant_filter, artefact_id=OuterRef("pk"))
    return Artefact.objects.filter(Q(restricted=False) | Exists(grant))
