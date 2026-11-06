"""URLs for pipeline (mounted at /api/). Owner: C."""
from django.urls import path

from .views import JobDetailView, StartJobView

urlpatterns = [
    path("jobs/", StartJobView.as_view(), name="job-start"),
    path("jobs/<uuid:job_id>/", JobDetailView.as_view(), name="job-detail"),
]
