"""Production settings: the Render server. Owner: A (settings); C (deployment)."""
from .base import *  # noqa: F401,F403
from .base import STORAGES, env

DEBUG = False

# Required in production: no fallback, so a missing key fails loudly at start-up.
SECRET_KEY = env("SECRET_KEY")

# Render sets RENDER_EXTERNAL_HOSTNAME (e.g. hifadithi-api.onrender.com) automatically.
_render_host = env("RENDER_EXTERNAL_HOSTNAME", default="")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])
if _render_host:
    ALLOWED_HOSTS.append(_render_host)

# Admin sign-in over HTTPS needs the site's own address here.
CSRF_TRUSTED_ORIGINS = env.list("CSRF_TRUSTED_ORIGINS", default=[])
if _render_host:
    CSRF_TRUSTED_ORIGINS.append(f"https://{_render_host}")

# Render handles HTTPS in front of Django and tells us through this header.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
# Tell browsers to use HTTPS only. Kept short (1 hour) while we're piloting.
SECURE_HSTS_SECONDS = 3600
# Render already redirects http:// to https:// before requests reach Django, and its health
# check calls us over plain HTTP inside its network, so Django must not redirect as well.
SILENCED_SYSTEM_CHECKS = ["security.W008"]

# Admin CSS/JS served by WhiteNoise (compressed, cache-friendly file names).
# It goes straight after SecurityMiddleware, as WhiteNoise's docs require.
MIDDLEWARE = list(MIDDLEWARE)  # noqa: F405
MIDDLEWARE.insert(
    MIDDLEWARE.index("django.middleware.security.SecurityMiddleware") + 1,
    "whitenoise.middleware.WhiteNoiseMiddleware",
)
STORAGES = {
    **STORAGES,
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Supabase connection: check it is still alive before reusing it.
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True  # noqa: F405

# Logs go to the console, which Render shows in its Logs tab.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}