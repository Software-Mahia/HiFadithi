"""URLs for pipeline (mounted at /api/). Owner: C."""
from django.urls import path

from .views import JobDetailView, MeshyWebhookView, PollJobsView, StartJobView

urlpatterns = [
    path("jobs/", StartJobView.as_view(), name="job-start"),
    path("jobs/poll/<str:token>/", PollJobsView.as_view(), name="job-poll"),
    path("jobs/<uuid:job_id>/", JobDetailView.as_view(), name="job-detail"),
    path("webhooks/meshy/<str:token>/", MeshyWebhookView.as_view(), name="meshy-webhook"),
]
