"""One error shape for the whole API: {"error": {"code": ..., "message": ...}}. Owner: A."""
from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:
        return None
    code = getattr(exc, "default_code", "error")
    data = response.data
    detail = data.get("detail", data) if isinstance(data, dict) else data
    response.data = {"error": {"code": code, "message": detail}}
    return response
