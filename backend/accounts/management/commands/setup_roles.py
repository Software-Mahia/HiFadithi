"""python manage.py setup_roles. Owner: A.

Creates a Django admin group per role and gives it the admin permissions for the demo.
Run it again after anyone adds models: it skips permissions that don't exist yet.
Users are put in their role's group automatically (accounts/signals.py).
"""
from django.contrib.auth.models import Group, Permission
from django.core.management.base import BaseCommand

# app_label.codename. Each owner adds their own lines.
ROLE_PERMISSIONS = {
    "researcher": [
        "artefacts.view_artefact", "artefacts.add_artefact", "artefacts.change_artefact",
        "artefacts.view_capture", "artefacts.add_capture",
        "pipeline.view_job",
        "workflow.view_modelversion", "workflow.change_modelversion",  # verify actions
        "workflow.view_verification",
        "narration.view_story", "narration.add_story", "narration.change_story",
    ],
    "curator": [
        "artefacts.view_artefact", "artefacts.view_capture",
        "pipeline.view_job",
        "workflow.view_modelversion", "workflow.change_modelversion",  # approve actions
        "workflow.view_verification", "workflow.view_approval",
        "narration.view_story",
    ],
    "admin": ["*"],
}


class Command(BaseCommand):
    help = "Create one admin group per role with the demo permissions."

    def handle(self, *args, **options):
        for role, codes in ROLE_PERMISSIONS.items():
            group, _ = Group.objects.get_or_create(name=role)
            if codes == ["*"]:
                perms = list(Permission.objects.all())
            else:
                perms = []
                for code in codes:
                    app_label, codename = code.split(".")
                    perm = Permission.objects.filter(
                        content_type__app_label=app_label, codename=codename
                    ).first()
                    if perm:
                        perms.append(perm)
                    else:
                        self.stdout.write(f"  skipped {code} (model not there yet)")
            group.permissions.set(perms)
            self.stdout.write(self.style.SUCCESS(f"{role}: {len(perms)} permissions"))
