"""Everything in workflow that WRITES. Owner: D.

These are the seams other apps call (see docs/seams.md). Every status change goes
through transition_model(), inside allow_status_change().
"""
from .guard import allow_status_change  # noqa: F401  (used by the real implementations)


def create_version(artefact, change_note, user):
    """Make version n+1 at Draft (artefact row locked). Returns the new ModelVersion.

    TODO (D): day 2.
    """
    raise NotImplementedError


def transition_model(model_version, to_status, reason="", actor=None):
    """The ONLY way to change review_status, is_current and collection_status.

    actor=None means the system (C's webhook and polling).
    Checks the move and the caller, enforces four-eyes against the latest verification,
    sets is_current, marks the previous version Superseded and updates the artefact's
    collection_status, all inside `with allow_status_change():`.

    TODO (D): placeholder with this signature on day 2, real version on day 3.
    """
    raise NotImplementedError


def check_tolerance(model_version, measurements, actor):
    """Compare width, depth and a landmark distance (height excluded); record a Verification.

    TODO (D).
    """
    raise NotImplementedError
