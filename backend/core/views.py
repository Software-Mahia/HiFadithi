"""Small shared views. Owner: A."""
import mimetypes
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, JsonResponse


def healthz(request):
    """Render's health check: answers without signing in or touching the database."""
    return JsonResponse({"status": "ok"})


def web_app(request, path=""):
    """Serve the Expo web export (mobile/dist) at the site root so the browser
    app and the API share one origin (no CORS). A real file is returned when it
    exists inside the build; every other path falls back to index.html for the
    app's client-side routing. Owner: A."""
    dist = Path(settings.WEB_DIST).resolve()
    candidate = (dist / path).resolve()
    # Serve a real asset only when it stays inside dist (blocks path traversal).
    if path and (candidate == dist or dist in candidate.parents) and candidate.is_file():
        target = candidate
    else:
        target = dist / "index.html"
    if not target.is_file():
        raise Http404("Web build not found; run `expo export --platform web` in mobile/.")
    content_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(open(target, "rb"), content_type=content_type or "application/octet-stream")