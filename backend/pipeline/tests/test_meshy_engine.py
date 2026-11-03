"""MeshyEngine against a fake Meshy server (httpx.MockTransport). No credits are spent."""
import json

import httpx
import pytest
from django.test import override_settings

from pipeline.engines import get_engine
from pipeline.engines.meshy import BASE_URL, MeshyEngine, MeshyError

PHOTOS = ["https://x/front.jpg", "https://x/back.jpg", "https://x/left.jpg", "https://x/right.jpg"]


def engine_with(handler, **kwargs):
    """A MeshyEngine whose HTTP calls go to `handler` instead of Meshy."""
    calls = []
    sleeps = []

    def recording_handler(request):
        calls.append(request)
        return handler(request)

    engine = MeshyEngine(
        api_key="test-key",
        ai_model="meshy-6-lite",
        client=httpx.Client(transport=httpx.MockTransport(recording_handler)),
        sleep=sleeps.append,
        **kwargs,
    )
    return engine, calls, sleeps


def test_submit_sends_the_photos_and_settings_and_returns_the_task_id():
    engine, calls, _ = engine_with(lambda r: httpx.Response(202, json={"result": "task-123"}))

    assert engine.submit(PHOTOS) == "task-123"

    request = calls[0]
    assert request.method == "POST"
    assert str(request.url) == BASE_URL
    assert request.headers["Authorization"] == "Bearer test-key"
    body = json.loads(request.content)
    assert body["image_urls"] == PHOTOS  # front first
    assert body["ai_model"] == "meshy-6-lite"
    assert body["should_texture"] is True
    assert body["target_formats"] == ["glb"]


def test_submit_needs_exactly_four_photos():
    engine, calls, _ = engine_with(lambda r: httpx.Response(202, json={"result": "x"}))
    with pytest.raises(ValueError):
        engine.submit(PHOTOS[:3])
    assert calls == []


def test_status_succeeded_gives_the_glb_link_and_credits():
    task = {
        "id": "task-123",
        "status": "SUCCEEDED",
        "progress": 100,
        "model_urls": {"glb": "https://assets.meshy.ai/model.glb"},
        "consumed_credits": 15,
        "task_error": {"message": ""},
    }
    engine, calls, _ = engine_with(lambda r: httpx.Response(200, json=task))

    status = engine.get_status("task-123")

    assert str(calls[0].url) == f"{BASE_URL}/task-123"
    assert status.status == "SUCCEEDED"
    assert status.glb_url == "https://assets.meshy.ai/model.glb"
    assert status.credits_used == 15
    assert status.error is None


def test_status_in_progress_has_no_glb_yet():
    task = {"status": "IN_PROGRESS", "progress": 50, "model_urls": {}}
    engine, _, _ = engine_with(lambda r: httpx.Response(200, json=task))
    status = engine.get_status("task-123")
    assert (status.status, status.progress, status.glb_url) == ("IN_PROGRESS", 50, None)


def test_status_failed_carries_meshys_error_message():
    task = {"status": "FAILED", "progress": 0, "consumed_credits": 0,
            "task_error": {"message": "Image could not be processed"}}
    engine, _, _ = engine_with(lambda r: httpx.Response(200, json=task))
    status = engine.get_status("task-123")
    assert status.status == "FAILED"
    assert status.error == "Image could not be processed"


def test_a_4xx_fails_at_once_with_meshys_message():
    engine, calls, sleeps = engine_with(
        lambda r: httpx.Response(400, json={"message": "Invalid image URL"})
    )
    with pytest.raises(MeshyError, match="Invalid image URL") as exc:
        engine.submit(PHOTOS)
    assert exc.value.status_code == 400
    assert len(calls) == 1 and sleeps == []


def test_server_errors_are_retried_three_times_then_reported_as_unavailable():
    engine, calls, sleeps = engine_with(lambda r: httpx.Response(503))
    with pytest.raises(MeshyError, match="Meshy unavailable"):
        engine.submit(PHOTOS)
    assert len(calls) == 3
    assert sleeps == [2, 4]


def test_connection_errors_are_retried_and_can_recover():
    responses = iter([httpx.ConnectError("down"), httpx.Response(202, json={"result": "task-9"})])

    def handler(request):
        item = next(responses)
        if isinstance(item, Exception):
            raise item
        return item

    engine, calls, sleeps = engine_with(handler)
    assert engine.submit(PHOTOS) == "task-9"
    assert len(calls) == 2 and sleeps == [2]


def test_rate_limit_waits_for_retry_after():
    responses = iter([
        httpx.Response(429, headers={"Retry-After": "7"}),
        httpx.Response(202, json={"result": "task-7"}),
    ])
    engine, _, sleeps = engine_with(lambda r: next(responses))
    assert engine.submit(PHOTOS) == "task-7"
    assert sleeps == [7]


def test_delete_treats_an_expired_task_as_deleted():
    engine, calls, _ = engine_with(lambda r: httpx.Response(404, json={"message": "Not found"}))
    engine.delete("old-task")
    assert calls[0].method == "DELETE"


def test_missing_api_key_is_a_clear_error():
    with override_settings(MESHY_API_KEY=""), pytest.raises(MeshyError, match="MESHY_API_KEY"):
        MeshyEngine()


@override_settings(ENGINE="meshy", MESHY_API_KEY="test-key")
def test_get_engine_returns_meshy_when_configured():
    assert isinstance(get_engine(), MeshyEngine)