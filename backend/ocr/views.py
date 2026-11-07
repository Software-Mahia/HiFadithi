from django.conf import settings
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsResearcher

from . import services
from .parsers import parse_fields


class OCRView(APIView):
    permission_classes = [IsResearcher]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get("image") or request.FILES.get("file")
        if upload is None:
            return Response(
                {"error": {"code": "image_required", "message": "Attach a card photo."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload.size > settings.OCR_MAX_IMAGE_BYTES:
            return Response(
                {
                    "error": {
                        "code": "image_too_large",
                        "message": "Card photo is larger than the allowed size.",
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload.content_type not in settings.ALLOWED_IMAGE_TYPES:
            return Response(
                {"error": {"code": "bad_image", "message": "Use a JPEG, PNG or WebP image."}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = services.extract_text(upload.read())
        except services.OCRUnavailable as exc:
            return Response(
                {"error": {"code": "ocr_unavailable", "message": str(exc)}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except ValueError as exc:
            return Response(
                {"error": {"code": "bad_image", "message": str(exc)}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        fields = parse_fields(result["raw_text"])
        return Response(
            {
                "fields": fields,
                "raw_text": result["raw_text"],
                "confidence": result["confidence"],
            }
        )
