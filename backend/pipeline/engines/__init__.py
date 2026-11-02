"""Pick the engine from settings.ENGINE ("fake" or "meshy"). Owner: C."""
from django.conf import settings

from .base import Engine


def get_engine() -> Engine:
    if settings.ENGINE == "meshy":
        from .meshy import MeshyEngine

        return MeshyEngine()
    from .fake import FakeEngine

    return FakeEngine()
