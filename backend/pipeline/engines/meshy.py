"""Meshy Multi-Image to 3D engine. Owner: C.

POST   https://api.meshy.ai/openapi/v1/multi-image-to-3d        -> {"result": "<task id>"}
GET    https://api.meshy.ai/openapi/v1/multi-image-to-3d/{id}   -> the task object
DELETE https://api.meshy.ai/openapi/v1/multi-image-to-3d/{id}
Header: Authorization: Bearer <MESHY_API_KEY>

Error handling (blueprint section 9):
- Meshy slow or down (no connection, 5xx): retry up to 3 attempts, then "Meshy unavailable".
- 429 (rate limit): wait for the Retry-After header, then retry.
- Other 4xx (for example a bad image): fail at once with Meshy's own message.

Starting a task (POST) is only retried when we know Meshy never received it: the connection
failed before sending, or Meshy answered 429. A timeout or 5xx after sending might mean the
task was created anyway, and retrying could start (and pay for) a second one.
"""
import time

import httpx
from django.conf import settings

from .base import Engine, TaskStatus

BASE_URL = "https://api.meshy.ai/openapi/v1/multi-image-to-3d"
MAX_RETRY_AFTER_SECONDS = 30
MAX_ERROR_TEXT = 300
KNOWN_STATUSES = {"PENDING", "IN_PROGRESS", "SUCCEEDED", "FAILED", "CANCELED"}
# Errors where the request never left our side, so a retry can't create a duplicate task.
NOT_SENT_ERRORS = (httpx.ConnectError, httpx.ConnectTimeout, httpx.PoolTimeout)


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
        task_id = data.get("result")
        if not task_id:
            reply = str(data)[:MAX_ERROR_TEXT]
            raise MeshyError(f"Meshy sent an unexpected reply with no task id: {reply}")
        return task_id

    def get_status(self, task_id: str) -> TaskStatus:
        data = self._request("GET", f"{BASE_URL}/{task_id}")
        status = data.get("status")
        if status not in KNOWN_STATUSES:
            # Never guess PENDING: the job would wait forever instead of failing.
            raise MeshyError(f"Meshy sent an unexpected task status: {status!r}")
        error = (data.get("task_error") or {}).get("message") or None
        return TaskStatus(
            status=status,
            progress=data.get("progress", 0),
            glb_url=(data.get("model_urls") or {}).get("glb") if status == "SUCCEEDED" else None,
            credits_used=data.get("consumed_credits"),
            error=error if status in ("FAILED", "CANCELED") else None,
        )

    def delete(self, task_id: str) -> None:
        """Delete the task and its files at Meshy. An already-expired task counts as deleted.

        Meshy refuses to delete a task that is still running (HTTP 409). That raises MeshyError
        with status_code 409: callers cleaning up should wait until the task has finished.
        """
        try:
            self._request("DELETE", f"{BASE_URL}/{task_id}")
        except MeshyError as exc:
            if exc.status_code == 404:
                return
            raise

    def _request(self, method: str, url: str, **kwargs) -> dict:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        is_post = method.upper() == "POST"
        last_error: MeshyError | None = None
        for attempt in range(1, self.max_attempts + 1):
            wait = 2**attempt  # 2 s, then 4 s
            try:
                response = self.client.request(method, url, headers=headers, **kwargs)
            except NOT_SENT_ERRORS:
                last_error = MeshyError("Meshy unavailable: could not connect.", retryable=True)
            except httpx.TransportError as exc:
                if is_post:
                    raise MeshyError(
                        "Meshy did not reply after the task was sent, so it may have started. "
                        "Not retrying, to avoid paying for a second task.",
                    ) from exc
                last_error = MeshyError(
                    f"Meshy unavailable: no reply ({type(exc).__name__}).", retryable=True
                )
            else:
                code = response.status_code
                if code == 429:
                    last_error = MeshyError(
                        "Meshy rate limit reached.", status_code=429, retryable=True
                    )
                    wait = _retry_after_seconds(response, default=wait)
                elif code >= 500:
                    if is_post:
                        raise MeshyError(
                            f"Meshy had an error (HTTP {code}) after the task was sent, so it may "
                            "have started. Not retrying, to avoid paying for a second task.",
                            status_code=code,
                        )
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
    detail = (message or response.text or "").strip()
    if len(detail) > MAX_ERROR_TEXT:
        detail = detail[:MAX_ERROR_TEXT] + "..."
    return f"Meshy refused the request (HTTP {response.status_code}): {detail}"