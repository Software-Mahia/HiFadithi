"""Django admin for pipeline: our demo screens. Owner: C.

Jobs are read-only: they change only through the pipeline services. A finished job
shows its AI-assisted 3D model in a <model-viewer> preview.
"""
from django.conf import settings
from django.contrib import admin
from django.core.exceptions import ImproperlyConfigured
from django.utils.html import format_html

from core.storage import MODELS_BUCKET, signed_download_url

from .models import Job

# Google's <model-viewer> web component (npm @google/model-viewer), a fixed version.
MODEL_VIEWER_JS = "https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js"
# Subresource Integrity: the browser refuses the script if the CDN ever serves different bytes.
# sha384 of dist/model-viewer.min.js in the npm package @google/model-viewer@4.0.0.
MODEL_VIEWER_SRI = "sha384-sr9b4Ux0WhAUGclJ0ym0FSY2zSOMmNSn0bP/SA0e6bNCrpn/5W3QL8mm+LdlQMKw"


def model_url(glb_path):
    """A link the browser can load the model from: signed (1 hour) on Supabase, local in dev."""
    try:
        return signed_download_url(MODELS_BUCKET, glb_path)
    except ImproperlyConfigured:
        return f"/{settings.MEDIA_URL.strip('/')}/{MODELS_BUCKET}/{glb_path}"


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "artefact", "version", "engine", "status", "progress", "credits_used",
                    "created_at")
    list_filter = ("status", "engine")
    search_fields = ("task_id", "model_version__artefact__nmk_accession_no",
                     "model_version__artefact__title")
    list_select_related = ("model_version__artefact",)
    readonly_fields = ["model_preview", "model_size"] + [f.name for f in Job._meta.fields]

    @admin.display(description="Artefact")
    def artefact(self, job):
        return job.model_version.artefact

    @admin.display(description="Version")
    def version(self, job):
        return job.model_version.version

    @admin.display(description="AI-assisted 3D model")
    def model_preview(self, job):
        path = job.model_version.glb_path
        if not path:
            return "No model yet."
        return format_html(
            '<script type="module" src="{}" integrity="{}" crossorigin="anonymous"></script>'
            '<model-viewer src="{}" alt="AI-assisted 3D model of {}" camera-controls '
            'auto-rotate shadow-intensity="1" '
            'style="width:480px;height:400px;background:#F1EAE4;border-radius:12px">'
            "</model-viewer>",
            MODEL_VIEWER_JS, MODEL_VIEWER_SRI, model_url(path), job.model_version.artefact,
        )

    @admin.display(description="Model size (model units, not yet scaled)")
    def model_size(self, job):
        v = job.model_version
        if v.bbox_width_mm is None:
            return "-"
        return f"{v.bbox_width_mm:g} mm wide x {v.bbox_depth_mm:g} mm deep, {v.triangles} triangles"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
