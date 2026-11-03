"""Meshy Multi-Image to 3D engine. Owner: C.

POST   https://api.meshy.ai/openapi/v1/multi-image-to-3d        -> {"result": "<task id>"}
GET    https://api.meshy.ai/openapi/v1/multi-image-to-3d/{id}   -> the task object
DELETE https://api.meshy.ai/openapi/v1/multi-image-to-3d/{id}
Header: Authorization: Bearer <MESHY_API_KEY>

Error handling (blueprint section 9):
- Meshy slow or down (no connection, 5xx): retry up to 3 attempts, then "Meshy unavailable".
- 429 (rate limit): wait for the Retry-After header, then retry.
- Other 4xx (for example a bad image): fail at once with Meshy's own message.
"""
import time

import httpx
from django.conf import settings

from .base import Engine, TaskStatus

BASE_URL = "https://api.meshy.ai/openapi/v1/multi-image-to-3d"
MAX_RETRY_AFTER_SECONDS = 30


class MeshyError(Exception):
    """Meshy refused the request or could not be reached. The message is safe to store."""

    def __init__(self, message: str, *, status_code: int | None = None, retryable: bool = False):
        super().__init__(message)
        self.status_code = status_code
        self.retryable = retryable


class MeshyEngine(Engine):
    def __init__(
        self,
        api_key: str | None = None,
        ai_model: str | None = None,
        client: httpx.Client | None = None,
        max_attempts: int = 3,
        sleep=time.sleep,
    ):
        self.api_key = api_key or settings.MESHY_API_KEY
        if not self.api_key:
            raise MeshyError("MESHY_API_KEY is not set. Use ENGINE=fake for local development.")
        self.ai_model = ai_model or getattr(settings, "MESHY_AI_MODEL", "meshy-6-lite")
        self.client = client or httpx.Client(timeout=30)
        self.max_attempts = max_attempts
        self.sleep = sleep

    def submit(self, image_urls: list[str]) -> str:
        """Start a task from 4 photo URLs, front first. Returns Meshy's task id."""
        if len(image_urls) != 4:
            raise ValueError("A capture needs exactly 4 photos: front, back, left, right.")
        body = {
            "image_urls": image_urls,
            "ai_model": self.ai_model,
            "should_texture": True,
            "target_formats": ["glb"],
            "target_polycount": 30000,
        }
        data = self._request("POST", BASE_URL, json=body)
        return data["result"]

    def get_status(self, task_id: str) -> TaskStatus:
        data = self._request("GET", f"{BASE_URL}/{task_id}")
        status = data.get("status", "PENDING")
        error = (data.get("task_error") or {}).get("message") or None
        return TaskStatus(
            status=status,
            progress=data.get("progress", 0),
            glb_url=(data.get("model_urls") or {}).get("glb") if status == "SUCCEEDED" else None,
            credits_used=data.get("consumed_credits"),
            error=error if status in ("FAILED", "CANCELED") else None,
        )

    def delete(self, task_id: str) -> None:
        """Delete the task and its files at Meshy. An already-expired task counts as deleted."""
        try:
            self._request("DELETE", f"{BASE_URL}/{task_id}")
        except MeshyError as exc:
            if exc.status_code == 404:
                return
            raise

    def _request(self, method: str, url: str, **kwargs) -> dict:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        last_error: MeshyError | None = None
        for attempt in range(1, self.max_attempts + 1):
            wait = 2**attempt  # 2 s, then 4 s
            try:
                response = self.client.request(method, url, headers=headers, **kwargs)
            except httpx.TransportError:
                last_error = MeshyError("Meshy unavailable: could not connect.", retryable=True)
            else:
                code = response.status_code
                if code == 429:
                    last_error = MeshyError(
                        "Meshy rate limit reached.", status_code=429, retryable=True
                    )
                    wait = _retry_after_seconds(response, default=wait)
                elif code >= 500:
                    last_error = MeshyError(
                        f"Meshy unavailable (HTTP {code}).", status_code=code, retryable=True
                    )
                elif code >= 400:
                    raise MeshyError(_meshy_message(response), status_code=code)
                else:
                    return response.json() if response.content else {}
            if attempt < self.max_attempts:
                self.sleep(wait)
        raise last_error


def _retry_after_seconds(response: httpx.Response, default: int) -> int:
    try:
        return min(int(response.headers.get("Retry-After", default)), MAX_RETRY_AFTER_SECONDS)
    except ValueError:
        return default


def _meshy_message(response: httpx.Response) -> str:
    try:
        message = response.json().get("message")
    except ValueError:
        message = None
    return f"Meshy refused the request (HTTP {response.status_code}): {message or response.text}"