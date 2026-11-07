from django.urls import path

from .views import NarrationView

urlpatterns = [
    path("artefacts/<uuid:pk>/narration/", NarrationView.as_view(), name="narration"),
]
