# One image for the API (gunicorn) and the worker (django-q2 qcluster).
# Ported from the hifadithi MVP deploy, adapted to HiFadithi's layout.
#
# Build context is the repo ROOT (render.yaml: rootDir: .), so paths are
# prefixed with backend/ or mobile/.

# --- Stage 1: build the Expo web export (mobile/dist) ---
# The browser app Django then serves at the site root (same origin as the API,
# so no CORS). Heavy on a free plan; if the Node build runs out of memory,
# fall back to a Render Static Site for mobile/dist + django-cors-headers.
FROM node:20-slim AS webbuild
WORKDIR /web
COPY mobile/package.json mobile/package-lock.json mobile/.npmrc ./
RUN npm ci
COPY mobile/ ./
RUN npx expo export --platform web

# --- Stage 2: the API image ---
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

# tesseract-ocr (+ eng/swa data) powers the museum-card OCR; ffmpeg converts
# Piper's WAV into the MP3 the app plays. libgl/libglib are needed by OpenCV.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
        tesseract-ocr \
        tesseract-ocr-eng \
        tesseract-ocr-swa \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --upgrade pip && pip install -r requirements.txt

# Piper TTS runs as a pip console script (no system binary needed).
RUN pip install "piper-tts>=1.3,<2" || echo "piper-tts unavailable; set PIPER_BIN to a bundled binary"

# Voice files are gitignored (181 MB), so they are fetched into the image at build
# time; they stay in step with the settings defaults (Dockerfile context can't
# read ../scripts). Renders rebuild on each deploy; the files are small enough
# for a free tier.
RUN mkdir -p /app/voices && \
    base="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0" && \
    for voice in \
        "en/en_GB/alba/medium/en_GB-alba-medium" \
        "sw/sw_CD/lanfrica/medium/sw_CD-lanfrica-medium"; do \
        name="$(basename "$voice")"; \
        curl -fL --retry 3 --retry-delay 2 -o "/app/voices/$name.onnx" "$base/$voice.onnx"; \
        curl -fL --retry 3 --retry-delay 2 -o "/app/voices/$name.onnx.json" "$base/$voice.onnx.json"; \
    done

COPY backend/ .
COPY backend/entrypoint.sh /entrypoint.sh
# The web app built in stage 1; WEB_DIST tells Django where to serve it from.
COPY --from=webbuild /web/dist /app/web
ENV WEB_DIST=/app/web
RUN chmod +x /entrypoint.sh \
    && useradd --create-home --uid 10001 app \
    && mkdir -p /app/media /app/staticfiles /app/voices \
    && chown -R app:app /app /app/media /app/staticfiles /app/voices /app/web

USER app

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
CMD ["web"]
