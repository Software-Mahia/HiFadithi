"""Django admin for pipeline: our demo screens. Owner: C.

Jobs are read-only: they change only through the pipeline services.
"""
from django.contrib import admin

from .models import Job


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "artefact", "version", "engine", "status", "progress", "credits_used",
                    "created_at")
    list_filter = ("status", "engine")
    search_fields = ("task_id", "model_version__artefact__nmk_accession_no",
                     "model_version__artefact__title")
    list_select_related = ("model_version__artefact",)
    readonly_fields = [f.name for f in Job._meta.fields]

    @admin.display(description="Artefact")
    def artefact(self, job):
        return job.model_version.artefact

    @admin.display(description="Version")
    def version(self, job):
        return job.model_version.version

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
