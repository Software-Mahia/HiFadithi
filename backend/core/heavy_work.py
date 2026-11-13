"""One heavy job at a time on this server: Piper narration or a 3D model copy. Owner: C.

Render's free plan has 512 MB of RAM. Piper (a voice model in memory) and the 3D model
copy (download + texture re-encode with Pillow) each need a few hundred MB, and with
Q_SYNC both run inside web requests, so a narration saved while a model was being copied
could be killed for memory and end "failed".

heavy_work() takes an operating-system file lock shared by every gunicorn worker and
thread in the container. The OS drops the lock when the holder exits, even if it was
killed, so a crash can never leave it stuck.

    with heavy_work(wait_seconds=45):
        ...  # raises HeavyWorkBusy if the other job still holds it after 45 s
"""
import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path

from django.conf import settings

POLL_SECONDS = 0.25

if os.name == "nt":  # Windows laptops (tests, local preview)
    import msvcrt

    def _try_lock(fd):
        try:
            os.lseek(fd, 0, os.SEEK_SET)
            msvcrt.locking(fd, msvcrt.LK_NBLCK, 1)
            return True
        except OSError:
            return False

    def _unlock(fd):
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)

else:  # Linux (Render)
    import fcntl

    def _try_lock(fd):
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return True
        except OSError:
            return False

    def _unlock(fd):
        fcntl.flock(fd, fcntl.LOCK_UN)


class HeavyWorkBusy(Exception):
    """The other heavy job kept the lock for longer than the caller was willing to wait."""


def lock_path() -> Path:
    configured = getattr(settings, "HEAVY_WORK_LOCK_FILE", "")
    if configured:
        return Path(configured)
    return Path(tempfile.gettempdir()) / "hifadithi-heavy-work.lock"


@contextmanager
def heavy_work(wait_seconds: float):
    """Hold the server-wide heavy-work lock for the `with` block."""
    fd = os.open(lock_path(), os.O_RDWR | os.O_CREAT, 0o600)
    try:
        deadline = time.monotonic() + wait_seconds
        while not _try_lock(fd):
            if time.monotonic() >= deadline:
                raise HeavyWorkBusy("Another heavy job is still running on the server.")
            time.sleep(POLL_SECONDS)
        try:
            yield
        finally:
            _unlock(fd)
    finally:
        os.close(fd)
