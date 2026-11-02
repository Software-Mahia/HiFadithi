"""Everything in access that WRITES. Owner: A.

Privacy deletions and restricted access.
"""


def delete_person_data(consent, actor):
    """Remove a narrator's audio, transcript and personal fields (Kenya's Data Protection Act).

    Uses D's Story and Consent; writes an audit row with D's log_audit() (the fact, not the
    content). Returns the list of deleted file paths.
    TODO (A): in the 6 days.
    """
    raise NotImplementedError


def remove_capture_photos(capture, reason, actor):
    """Delete a capture's photos from storage AND the Meshy task that used them.

    For example when a person appears in a photo. Steps:
    1. Delete each file in capture.views from the captures bucket (core.storage).
    2. For each Job that used this capture, call pipeline.engines.get_engine().delete(task_id).
       An already-expired Meshy task counts as deleted.
    3. log_audit(actor, "capture_photos_removed", capture) with the reason.
    Returns {"deleted_files": [...], "meshy_tasks_deleted": [...]}.
    TODO (A): deferred until after day 6 (stub kept so the seam exists).
    """
    raise NotImplementedError
