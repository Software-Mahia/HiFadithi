from django.test import override_settings

from pipeline.engines import get_engine
from pipeline.engines.fake import FakeEngine


@override_settings(ENGINE="fake")
def test_fake_engine_is_default():
    assert isinstance(get_engine(), FakeEngine)
