"""URL map. Each owner adds ONE include() line for their app. Owner: A."""
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/accounts/", include("accounts.urls")),    # A
    path("api/artefacts/", include("artefacts.urls")),  # B
    path("api/", include("pipeline.urls")),             # C: jobs/, webhooks/meshy/<token>/
    path("api/", include("workflow.urls")),             # D: versions/, verifications/, approvals/
    path("api/", include("narration.urls")),            # D: stories/, consents/
]
