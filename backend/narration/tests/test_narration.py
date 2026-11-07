import pytest

from narration import services
from narration.models import Narration, NarrationStatus


@pytest.mark.django_db
def test_save_story_queues_generation(artefact, monkeypatch):
    calls = []
    monkeypatch.setattr(services, "enqueue_narration", lambda narration: calls.append(narration.id))
    narration = services.save_story(artefact, story_text="A short story.", language="en")
    assert narration.status == NarrationStatus.GENERATING
    assert narration.voice.endswith(".onnx")
    assert calls == [narration.id]


@pytest.mark.django_db
def test_unchanged_ready_story_is_not_regenerated(artefact, monkeypatch):
    voice_name = services.Path(services.voice_for("en")).name
    fingerprint = services._synthesis_fingerprint("Same story", "en", voice_name)
    narration = Narration.objects.create(
        artefact=artefact,
        story_text="Same story",
        language="en",
        status=NarrationStatus.READY,
        audio_path="x/narration.mp3",
        voice=voice_name,
        text_hash=fingerprint,
    )
    calls = []
    monkeypatch.setattr(services, "enqueue_narration", lambda n: calls.append(n.id))
    services.save_story(artefact, story_text="Same story", language="en")
    narration.refresh_from_db()
    assert narration.status == NarrationStatus.READY
    assert calls == []


@pytest.mark.django_db
def test_voice_swap_regenerates_ready_story(artefact, monkeypatch):
    """Config only changed the synthesized voice: stored audio must refresh."""
    old_voice = "old.onnx"
    narration = Narration.objects.create(
        artefact=artefact,
        story_text="Same story",
        language="en",
        status=NarrationStatus.READY,
        audio_path="x/narration.mp3",
        voice=old_voice,
        text_hash=services._synthesis_fingerprint("Same story", "en", old_voice),
    )
    calls = []
    monkeypatch.setattr(services, "enqueue_narration", lambda n: calls.append(n.id))
    services.save_story(artefact, story_text="Same story", language="en")
    narration.refresh_from_db()
    assert narration.status == NarrationStatus.GENERATING
    assert narration.voice != old_voice
    assert calls == [narration.id]


@pytest.mark.django_db
def test_generate_narration_saves_audio(artefact, settings, tmp_path, monkeypatch):
    settings.MEDIA_ROOT = tmp_path
    narration = Narration.objects.create(
        artefact=artefact,
        story_text="A story",
        language="en",
        status=NarrationStatus.GENERATING,
        voice="en.onnx",
    )
    monkeypatch.setattr(services, "_synthesize_mp3", lambda text, voice: b"mp3-bytes")
    result = services.generate_narration(str(narration.id))
    assert result.status == NarrationStatus.READY
    path = tmp_path / "narration" / str(artefact.id) / "narration.mp3"
    assert path.read_bytes() == b"mp3-bytes"


@pytest.mark.django_db
def test_generate_narration_reports_missing_piper(artefact, monkeypatch):
    narration = Narration.objects.create(
        artefact=artefact,
        story_text="A story",
        language="en",
        status=NarrationStatus.GENERATING,
    )
    # _binary/_ffmpeg_bin: PATH + pip console scripts + imageio-ffmpeg fallbacks
    monkeypatch.setattr(services, "_binary", lambda name: "")
    monkeypatch.setattr(services, "_ffmpeg_bin", lambda: "")
    result = services.generate_narration(str(narration.id))
    assert result.status == NarrationStatus.FAILED
    assert "Piper" in result.error


@pytest.mark.django_db
def test_empty_story_clears_status(artefact):
    narration = Narration.objects.create(
        artefact=artefact, story_text="Old", status=NarrationStatus.READY
    )
    result = services.save_story(artefact, story_text="", language="en")
    assert result.status == NarrationStatus.NONE
    assert narration.audio_path == ""
