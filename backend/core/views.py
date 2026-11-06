"""Small shared views. Owner: A."""
from django.http import JsonResponse


def healthz(request):
    """Render's health check: answers without signing in or touching the database."""
    return JsonResponse({"status": "ok"})