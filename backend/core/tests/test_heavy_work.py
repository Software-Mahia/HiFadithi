import pytest

from core.heavy_work import HeavyWorkBusy, heavy_work


@pytest.fixture(autouse=True)
def lock_file(settings, tmp_path):
    settings.HEAVY_WORK_LOCK_FILE = str(tmp_path / "heavy.lock")


def test_a_second_heavy_job_is_refused_while_the_first_runs():
    with heavy_work(wait_seconds=0):
        with pytest.raises(HeavyWorkBusy):
            with heavy_work(wait_seconds=0.3):
                pass


def test_the_lock_is_free_again_after_the_job_ends():
    with heavy_work(wait_seconds=0):
        pass
    with heavy_work(wait_seconds=0):
        pass


def test_the_lock_is_released_when_the_job_raises():
    with pytest.raises(ValueError):
        with heavy_work(wait_seconds=0):
            raise ValueError("boom")
    with heavy_work(wait_seconds=0):
        pass
