"""Pick the engine from settings.ENGINE ("fake" or "meshy"). Owner: C."""
from django.conf import settings

from .base import Engine


def get_engine(name: str | None = None) -> Engine:
    """The engine called `name`, or settings.ENGINE. A job uses the engine that started it."""
    if (name or settings.ENGINE) == "meshy":
        from .meshy import MeshyEngine

        return MeshyEngine()
    from .fake import FakeEngine

    return FakeEngine()
