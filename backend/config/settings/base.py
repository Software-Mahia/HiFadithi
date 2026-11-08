"""Shared settings. Owner: A."""
from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / ".env")

SECRET_KEY = env("SECRET_KEY", default="dev-only-insecure-key-change-me-in-your-env-file-0123")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["127.0.0.1", "localhost"])

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "django_q",
    "storages",
    # Our apps (owner in brackets)
    "accounts",   # A
    "access",     # A
    "artefacts",  # B
    "pipeline",   # C
    "workflow",   # D
    "audit",      # D
    "narration",  # D
    "ocr",        # ported: museum-card OCR for the mobile app
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# An empty DATABASE_URL= line in .env counts as "not set".
DATABASE_URL = env("DATABASE_URL", default="") or f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
DATABASES = {"default": env.db_url_config(DATABASE_URL)}
DATABASES["default"]["CONN_MAX_AGE"] = 60
# Local development is sqlite with several processes (web, qcluster worker);
# give concurrent writers a short wait instead of an instant 'database is
# locked' error (seconds in the sqlite backend's OPTIONS).
if DATABASE_URL.startswith("sqlite"):
    DATABASES["default"]["OPTIONS"] = {"timeout": 20}

AUTH_USER_MODEL = "accounts.User"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
]

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Africa/Nairobi"
USE_I18N = True
USE_TZ = True  # stored in UTC, shown in Nairobi time

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# File storage. Uploaded files: local folder by default, Supabase Storage when switched on.
# Static files (admin CSS/JS): Django's default here; WhiteNoise in production.py.
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# Supabase Storage through its S3-compatible API (owner: B).
# Used by core.storage to switch between bucket URLs and the local MEDIA_ROOT mirror.
USE_SUPABASE_STORAGE = env.bool("USE_SUPABASE_STORAGE", default=False)
if USE_SUPABASE_STORAGE:
    STORAGES["default"] = {"BACKEND": "storages.backends.s3.S3Storage"}
    AWS_S3_ENDPOINT_URL = env("SUPABASE_S3_ENDPOINT")
    AWS_S3_REGION_NAME = env("SUPABASE_S3_REGION")
    AWS_ACCESS_KEY_ID = env("SUPABASE_S3_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = env("SUPABASE_S3_SECRET_ACCESS_KEY")
    AWS_DEFAULT_ACL = None
    AWS_QUERYSTRING_AUTH = True
    AWS_QUERYSTRING_EXPIRE = 3600

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "EXCEPTION_HANDLER": "core.errors.exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=1),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# Background tasks (django-q2) using the database as the queue: no Redis needed.
# Q_SYNC=True runs each task inside the request instead of a worker process —
# used on Render's free plan, which has no background workers (narration then
# takes a few seconds directly in the API call; the 3D pipeline never needed
# the worker: webhook + job page + poll keep it moving). Local dev defaults
# to False so `manage.py qcluster` behaves normally.
Q_CLUSTER = {
    "name": "hifadithi",
    "orm": "default",
    "workers": 2,
    "timeout": 120,
    "retry": 180,
}
Q_CLUSTER["sync"] = env.bool("Q_SYNC", default=False)

# Meshy (owner: C)
ENGINE = env("ENGINE", default="fake")
FAKE_ENGINE_GLB_URL = env(
    "FAKE_ENGINE_GLB_URL",
    default="https://gsefmwehmvvugcfgakbj.supabase.co/storage/v1/object/public/samples/demo-model.glb",
)
FAKE_ENGINE_SECONDS = env.int("FAKE_ENGINE_SECONDS", default=5)
MESHY_API_KEY = env("MESHY_API_KEY", default="")
MESHY_AI_MODEL = env("MESHY_AI_MODEL", default="meshy-6-lite")  # meshy-7.1 for the pilot
MESHY_WEBHOOK_TOKEN = env("MESHY_WEBHOOK_TOKEN", default="")
MESHY_MONTHLY_CREDIT_LIMIT = env.int("MESHY_MONTHLY_CREDIT_LIMIT", default=300)

# --- Ported from the hifadithi MVP -------------------------------------------

# Public base URL used in media links when Supabase Storage is off (local dev);
# in production the mobile app bundles this so its images/audio resolve.
PUBLIC_BASE_URL = env("PUBLIC_BASE_URL", default="http://127.0.0.1:8000").rstrip("/")

# Presigned link lifetime for bucket URLs handed to the app.
PRESIGN_EXPIRES_SECONDS = env.int("PRESIGN_EXPIRES_SECONDS", default=3600)

# Artefact photo upload cap (the app's slot-by-slot images).
MAX_IMAGE_BYTES = env.int("MAX_IMAGE_BYTES", default=10 * 1024 * 1024)

# OCR (ported): pytesseract languages and image size cap.
OCR_LANGUAGES = env("OCR_LANGUAGES", default="eng+swa")
OCR_MAX_IMAGE_BYTES = env.int("OCR_MAX_IMAGE_BYTES", default=10 * 1024 * 1024)
ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

# Narration/TTS (ported): Piper voice synthesizer, run via the piper-tts pip
# package (PIPER_BIN defaults to the pip-installed console script) with MP3
# conversion through the bundled ffmpeg from the imageio-ffmpeg package.
PIPER_BIN = env("PIPER_BIN", default="piper")
PIPER_VOICES_DIR = env("PIPER_VOICES_DIR", default=str(BASE_DIR / "voices"))
PIPER_VOICE_EN = env("PIPER_VOICE_EN", default="en_GB-alba-medium.onnx")
PIPER_VOICE_SW = env("PIPER_VOICE_SW", default="sw_CD-lanfrica-medium.onnx")
PIPER_LENGTH_SCALE = env.float("PIPER_LENGTH_SCALE", default=1.0)
FFMPEG_BIN = env("FFMPEG_BIN", default="ffmpeg")
