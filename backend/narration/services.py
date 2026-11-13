"""Narration writes: save the story and synthesise MP3 audio with local Piper TTS."""

import hashlib
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from django.conf import settings

from core import storage
from core.heavy_work import HeavyWorkBusy, heavy_work
from core.storage import NARRATION_BUCKET

from .models import Language, Narration, NarrationStatus

logger = logging.getLogger(__name__)

# How long a narration waits for a 3D model copy to finish. Synthesis runs inside the
# request (Q_SYNC), so wait + synthesis must stay well under gunicorn's 120 s timeout.
NARRATION_WAIT_SECONDS = 45
BUSY_MESSAGE = (
    "The server is busy finishing a 3D model. Save the story again in a minute."
)

VOICE_BY_LANGUAGE = {
    Language.ENGLISH: "PIPER_VOICE_EN",
    Language.SWAHILI: "PIPER_VOICE_SW",
}


def _hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _synthesis_fingerprint(story_text, language, voice_name):
    """A save only re-synthesizes when the words, language or voice changed —
    hashing all three keeps the stored audio from going stale when a voice is
    swapped in settings."""
    return _hash(f"{story_text}|{language}|{voice_name}")


def voice_for(language):
    setting = VOICE_BY_LANGUAGE.get(language, "PIPER_VOICE_EN")
    voice = getattr(settings, setting, "")
    if not voice:
        return ""
    path = Path(voice)
    if path.is_absolute():
        return str(path)
    return str(Path(settings.PIPER_VOICES_DIR) / voice)


def save_story(artefact, *, story_text, language):
    story_text = (story_text or "").strip()
    language = language or Language.ENGLISH
    narration, _ = Narration.objects.get_or_create(artefact=artefact)
    was_ready = narration.status == NarrationStatus.READY and bool(narration.audio_path)
    voice_name = Path(voice_for(language)).name if story_text else ""
    fingerprint = _synthesis_fingerprint(story_text, language, voice_name) if story_text else ""
    needs_synthesis = fingerprint != narration.text_hash

    narration.story_text = story_text
    narration.language = language
    narration.voice = voice_name
    narration.text_hash = fingerprint
    narration.error = ""
    if not story_text:
        narration.status = NarrationStatus.NONE
    elif needs_synthesis or not was_ready:
        narration.status = NarrationStatus.GENERATING
    else:
        narration.status = NarrationStatus.READY
    narration.save()

    if narration.status == NarrationStatus.GENERATING:
        enqueue_narration(narration)
    return narration


def enqueue_narration(narration):
    if getattr(settings, "TASKS_EAGER", False):
        generate_narration(str(narration.id))
        return
    from django_q.tasks import async_task

    async_task("narration.tasks.generate_narration_task", str(narration.id))


def _binary(name):
    """Find a command: PATH first, then this environment's bin dir (pip console
    scripts, e.g. .venv/bin/piper) — the server process may not have the venv
    on PATH, and resolving the interpreter symlink would escape the venv."""
    found = shutil.which(name)
    if found:
        return found
    for directory in (Path(sys.prefix) / "bin", Path(sys.executable).absolute().parent):
        candidate = directory / name
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return ""


def _ffmpeg_bin():
    """ffmpeg: PATH, pip console script, or the imageio-ffmpeg bundled binary."""
    found = _binary(getattr(settings, "FFMPEG_BIN", "ffmpeg"))
    if found:
        return found
    try:
        import imageio_ffmpeg  # pip package that ships a working ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except (ImportError, RuntimeError):
        return ""


def _synthesize_mp3(text, voice_path):
    """Run Piper to a temporary WAV, then ffmpeg to MP3. Returns the MP3 bytes."""
    piper_bin = _binary(getattr(settings, "PIPER_BIN", "piper"))
    if not piper_bin:
        raise RuntimeError("Piper is not installed. Install piper-tts or set PIPER_BIN.")
    if not Path(voice_path).exists():
        raise RuntimeError(
            f"Piper voice not found at {voice_path}. Download it with scripts/download_voices.sh."
        )
    ffmpeg_bin = _ffmpeg_bin()
    if not ffmpeg_bin:
        raise RuntimeError(
            "ffmpeg is not installed (pip install imageio-ffmpeg provides one); "
            "it is needed to produce MP3 audio."
        )

    with tempfile.TemporaryDirectory(prefix="hifadithi-tts-") as tmp:
        wav_path = Path(tmp) / "narration.wav"
        mp3_path = Path(tmp) / "narration.mp3"
        command = [
            piper_bin,
            "--model",
            str(voice_path),
            "--output_file",
            str(wav_path),
            "--length_scale",
            str(getattr(settings, "PIPER_LENGTH_SCALE", 1.0)),
        ]
        subprocess.run(
            command,
            input=text.encode("utf-8"),
            check=True,
            capture_output=True,
            timeout=120,
        )
        subprocess.run(
            [
                ffmpeg_bin,
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(wav_path),
                "-codec:a",
                "libmp3lame",
                "-qscale:a",
                "4",
                str(mp3_path),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
        return mp3_path.read_bytes()


def generate_narration(narration_id):
    narration = Narration.objects.select_related("artefact").filter(pk=narration_id).first()
    if narration is None or not narration.story_text:
        return narration

    voice_path = voice_for(narration.language)
    try:
        # Never alongside a 3D model copy: together they can exceed the server's memory.
        with heavy_work(wait_seconds=NARRATION_WAIT_SECONDS):
            audio = _synthesize_mp3(narration.story_text, voice_path)
    except HeavyWorkBusy:
        logger.warning("Narration %s skipped: a 3D model is still being processed", narration_id)
        narration.status = NarrationStatus.FAILED
        narration.error = BUSY_MESSAGE
        narration.save(update_fields=["status", "error", "updated_at"])
        return narration
    except (RuntimeError, subprocess.SubprocessError, OSError) as exc:
        logger.exception("Narration failed for %s", narration_id)
        narration.status = NarrationStatus.FAILED
        narration.error = str(exc)[:2000]
        narration.save(update_fields=["status", "error", "updated_at"])
        return narration

    path = f"{narration.artefact_id}/narration.mp3"
    storage.save_bytes(NARRATION_BUCKET, path, audio, "audio/mpeg")
    old_path = narration.audio_path
    narration.audio_path = path
    narration.status = NarrationStatus.READY
    narration.error = ""
    narration.voice = Path(voice_path).name  # keep the row honest about the voice used
    narration.save(update_fields=["audio_path", "status", "error", "updated_at"])
    if old_path and old_path != path:
        storage.delete_file(NARRATION_BUCKET, old_path)
    return narration


def delete_narration(narration):
    if narration.audio_path:
        storage.delete_file(NARRATION_BUCKET, narration.audio_path)
    narration.audio_path = ""
    narration.status = NarrationStatus.NONE
    narration.story_text = ""
    narration.text_hash = ""
    narration.save()
