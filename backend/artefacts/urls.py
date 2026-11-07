"""URLs for artefacts. Owner: B. Includes ported mobile-app routes."""
from django.urls import path

from . import views

urlpatterns = [
    path("", views.ArtefactListCreateView.as_view(), name="artefact-list"),
    path("<uuid:artefact_id>/", views.ArtefactDetailView.as_view(), name="artefact-detail"),
    path("<uuid:artefact_id>/captures/", views.StartCaptureView.as_view(), name="capture-start"),
    path(
        "captures/<uuid:capture_id>/complete/",
        views.CompleteCaptureView.as_view(),
        name="capture-complete",
    ),
    # --- ported from the hifadithi MVP (mobile app pipeline) ---
    path("<uuid:artefact_id>/images/presign/", views.PresignImageView.as_view(),
         name="image-presign"),
    path("<uuid:artefact_id>/images/", views.ImageUploadView.as_view(), name="image-upload"),
    path("<uuid:artefact_id>/images/confirm/", views.ConfirmImageView.as_view(),
         name="image-confirm"),
    path("<uuid:artefact_id>/publish/", views.PublishView.as_view(), name="artefact-publish"),
    path("<uuid:artefact_id>/unpublish/", views.UnpublishView.as_view(),
         name="artefact-unpublish"),
]
