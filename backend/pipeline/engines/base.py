"""The engine interface. Owner: C."""
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class TaskStatus:
    status: str            # PENDING, IN_PROGRESS, SUCCEEDED, FAILED, CANCELED
    progress: int = 0
    glb_url: str | None = None
    credits_used: int | None = None
    error: str | None = None


class Engine(ABC):
    @abstractmethod
    def submit(self, image_urls: list[str]) -> str:
        """Start a task from 4 photo URLs (front first). Returns the provider task id."""

    @abstractmethod
    def get_status(self, task_id: str) -> TaskStatus:
        """Fetch the task's current status from the provider."""

    @abstractmethod
    def delete(self, task_id: str) -> None:
        """Delete the task and its files at the provider."""
