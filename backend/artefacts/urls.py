"""URLs for artefacts. Owner: B."""
from django.urls import path

from . import views

urlpatterns = [
    path("", views.ArtefactCreateView.as_view(), name="artefact-create"),
    path("<uuid:artefact_id>/captures/", views.StartCaptureView.as_view(), name="capture-start"),
    path(
        "captures/<uuid:capture_id>/complete/",
        views.CompleteCaptureView.as_view(),
        name="capture-complete",
    ),
]
