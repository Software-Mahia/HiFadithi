"""URL map. Each owner adds ONE include() line for their app. Owner: A."""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.views import healthz, web_app

urlpatterns = [
    path("healthz/", healthz, name="healthz"),
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view(), name="token"),
    path("api/auth/token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("api/accounts/", include("accounts.urls")),    # A
    path("api/artefacts/", include("artefacts.urls")),  # B
    path("api/", include("pipeline.urls")),             # C: jobs/, webhooks/meshy/<token>/
    path("api/", include("workflow.urls")),             # D: versions/, verifications/, approvals/
    path("api/", include("narration.urls")),            # D: narration of an artefact
    path("api/", include("artefacts.public_urls")),     # ported: guest gallery
    path("api/", include("ocr.urls")),                  # ported: /api/ocr/
]

# Ported: in development (no Supabase Storage), photo/audio/GLB files are written
# to MEDIA_ROOT and served at MEDIA_URL so the app works without cloud credentials.
if settings.DEBUG or not settings.USE_SUPABASE_STORAGE:
    from django.conf.urls.static import static

    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Same-origin web app. This catch-all serves the Expo web export at the site root
# and MUST stay last so every /api, /admin, /healthz, /static and /media route is
# matched before it. Owner: A.
urlpatterns += [
    re_path(r"^(?!api/|admin|static/|media/|healthz)(?P<path>.*)$", web_app, name="web-app"),
]

