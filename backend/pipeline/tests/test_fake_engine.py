import pytest

from pipeline.engines.fake import FakeEngine

PHOTOS = ["https://x/front.jpg", "https://x/back.jpg", "https://x/left.jpg", "https://x/right.jpg"]


class Clock:
    """A clock the test can move forward."""

    def __init__(self, now=1_000_000):
        self.now = now

    def __call__(self):
        return self.now


def make_engine(clock):
    return FakeEngine(seconds=10, glb_url="https://example.com/sample.glb", clock=clock)


def test_task_goes_pending_then_in_progress_then_succeeded():
    clock = Clock()
    engine = make_engine(clock)
    task_id = engine.submit(PHOTOS)

    assert engine.get_status(task_id).status == "PENDING"
    clock.now += 6
    assert engine.get_status(task_id).status == "IN_PROGRESS"
    clock.now += 5
    status = engine.get_status(task_id)
    assert status.status == "SUCCEEDED"
    assert status.glb_url == "https://example.com/sample.glb"
    assert status.credits_used == 0


def test_a_photo_url_containing_fail_makes_the_task_fail():
    clock = Clock()
    engine = make_engine(clock)
    task_id = engine.submit(PHOTOS[:3] + ["https://x/fail.jpg"])
    clock.now += 11
    status = engine.get_status(task_id)
    assert status.status == "FAILED"
    assert status.glb_url is None


def test_needs_exactly_four_photos():
    with pytest.raises(ValueError):
        make_engine(Clock()).submit(PHOTOS[:3])


def test_each_submit_gets_a_new_task_id():
    engine = make_engine(Clock())
    assert engine.submit(PHOTOS) != engine.submit(PHOTOS)


def test_unknown_task_id_is_rejected():
    with pytest.raises(ValueError):
        make_engine(Clock()).get_status("not-a-fake-id")


def test_delete_accepts_a_fake_task():
    engine = make_engine(Clock())
    engine.delete(engine.submit(PHOTOS))
