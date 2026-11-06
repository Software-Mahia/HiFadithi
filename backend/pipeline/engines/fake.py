"""Fake engine for everyday development: behaves like Meshy, spends no credits. Owner: C.

The task id carries everything the fake needs (outcome and start time), so status checks
work across requests and processes without storing anything:

    fake-<ok|fail>-<unix start time>-<random>

Timeline after submit():  PENDING  ->  IN_PROGRESS  ->  SUCCEEDED (or FAILED)
                          0s          seconds/2        seconds (default 5)

To test a failure, include the word "fail" in any of the photo URLs.
"""
import time
import uuid

from django.conf import settings

from .base import Engine, TaskStatus

# A small public GLB (Khronos glTF sample "Duck"), used as the fake result.
SAMPLE_GLB_URL = (
    "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/"
    "Models/Duck/glTF-Binary/Duck.glb"
)


class FakeEngine(Engine):
    def __init__(self, seconds=None, glb_url=None, clock=time.time):
        self.seconds = seconds if seconds is not None else getattr(
            settings, "FAKE_ENGINE_SECONDS", 5
        )
        self.glb_url = glb_url or getattr(settings, "FAKE_ENGINE_GLB_URL", SAMPLE_GLB_URL)
        self.clock = clock

    def submit(self, image_urls: list[str]) -> str:
        if len(image_urls) != 4:
            raise ValueError("A capture needs exactly 4 photos: front, back, left, right.")
        outcome = "fail" if any("fail" in url for url in image_urls) else "ok"
        return f"fake-{outcome}-{int(self.clock())}-{uuid.uuid4().hex[:8]}"

    def get_status(self, task_id: str) -> TaskStatus:
        outcome, started = self._parse(task_id)
        elapsed = self.clock() - started
        if elapsed < self.seconds / 2:
            return TaskStatus(status="PENDING", progress=0)
        if elapsed < self.seconds:
            return TaskStatus(status="IN_PROGRESS", progress=50)
        if outcome == "fail":
            return TaskStatus(
                status="FAILED", progress=0, credits_used=0,
                error="Fake failure: a photo URL contained 'fail'.",
            )
        return TaskStatus(status="SUCCEEDED", progress=100, glb_url=self.glb_url, credits_used=0)

    def delete(self, task_id: str) -> None:
        self._parse(task_id)  # nothing stored, so nothing to delete

    @staticmethod
    def _parse(task_id: str) -> tuple[str, int]:
        parts = task_id.split("-")
        if len(parts) != 4 or parts[0] != "fake" or parts[1] not in ("ok", "fail"):
            raise ValueError(f"Not a fake task id: {task_id!r}")
        return parts[1], int(parts[2])
