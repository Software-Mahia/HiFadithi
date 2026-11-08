"""Public (guest gallery) artefact URLs — mounted at /api/ by config/urls.py.

Ported from the hifadithi MVP's artefacts.urls.public_urlpatterns.
"""
from django.urls import path

from .views import PublicArtefactDetailView, PublicArtefactListView, PublicArtefactModelView

urlpatterns = [
    path("public/artefacts/", PublicArtefactListView.as_view(), name="public-artefact-list"),
    path(
        "public/artefacts/<uuid:artefact_id>/",
        PublicArtefactDetailView.as_view(),
        name="public-artefact-detail",
    ),
    path(
        "public/artefacts/<uuid:artefact_id>/model/",
        PublicArtefactModelView.as_view(),
        name="public-artefact-model",
    ),
]
