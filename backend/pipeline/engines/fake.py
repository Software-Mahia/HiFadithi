"""Fake engine for everyday development: no credits spent. Owner: C."""
from .base import Engine, TaskStatus


class FakeEngine(Engine):
    def submit(self, image_urls: list[str]) -> str:
        raise NotImplementedError("TODO (C)")

    def get_status(self, task_id: str) -> TaskStatus:
        raise NotImplementedError("TODO (C)")

    def delete(self, task_id: str) -> None:
        raise NotImplementedError("TODO (C)")
