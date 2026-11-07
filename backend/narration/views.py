from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from artefacts.selectors import artefacts_for_user
from core.permissions import IsResearcher

from . import services
from .serializers import NarrationSerializer, NarrationWriteSerializer


class NarrationView(APIView):
    permission_classes = [IsResearcher]

    def _artefact(self, request, pk):
        return artefacts_for_user(request.user).filter(pk=pk).first()

    def get(self, request, pk):
        artefact = self._artefact(request, pk)
        if artefact is None:
            return Response(
                {"error": {"code": "not_found", "message": "Artefact not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        narration = getattr(artefact, "narration", None)
        if narration is None:
            return Response({"status": "none", "story_text": "", "audio_url": None})
        return Response(NarrationSerializer(narration).data)

    def put(self, request, pk):
        artefact = self._artefact(request, pk)
        if artefact is None:
            return Response(
                {"error": {"code": "not_found", "message": "Artefact not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = NarrationWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        narration = services.save_story(artefact, **serializer.validated_data)
        return Response(NarrationSerializer(narration).data, status=status.HTTP_202_ACCEPTED)

    def delete(self, request, pk):
        artefact = self._artefact(request, pk)
        if artefact is None:
            return Response(
                {"error": {"code": "not_found", "message": "Artefact not found."}},
                status=status.HTTP_404_NOT_FOUND,
            )
        narration = getattr(artefact, "narration", None)
        if narration is not None:
            services.delete_narration(narration)
        return Response(status=status.HTTP_204_NO_CONTENT)
