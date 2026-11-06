"""python manage.py seed_demo [--email you@example.com] [--force]. Owner: B.

Creates 5 clearly fake artefacts (DEMO-001 to DEMO-005), one empty Capture each, and
model versions in a spread of review states, so list pages have variety.

- Everything is invented. No real NMK records, photos or narrator data.
- Safe to run twice: artefacts are looked up by nmk_accession_no, and an artefact that
  already has versions or a capture gets no more.
- Never creates users, passwords or tokens. created_by is an existing user.
- Review and collection statuses change ONLY through workflow.services.transition_model().
- Refuses to run unless DEBUG is true or --force is passed.
"""
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from artefacts.models import Artefact, Capture
from workflow.models import ModelVersion
from workflow.services import create_version, transition_model

S = ModelVersion.Status

# The path a version walks from Draft, written as plausible steps in case the real
# move rules (workflow) become strict. Each entry is one version, oldest first.
DEMO_ARTEFACTS = [
    {
        "nmk_accession_no": "DEMO-001",
        "title": "DEMO: sample clay pot",
        "object_type": "Vessel",
        "materials": "Fired clay (demo data)",
        "dims": ("240.0", "180.0", "180.0"),
        "versions": [],
    },
    {
        "nmk_accession_no": "DEMO-002",
        "title": "DEMO: sample wooden stool",
        "object_type": "Furniture",
        "materials": "Wood (demo data)",
        "dims": ("320.0", "280.0", "280.0"),
        "versions": [[S.PROCESSING]],
    },
    {
        "nmk_accession_no": "DEMO-003",
        "title": "DEMO: sample woven basket",
        "object_type": "Basketry",
        "materials": "Plant fibre (demo data)",
        "dims": ("150.0", "300.0", "300.0"),
        "versions": [[S.PROCESSING, S.NEEDS_VERIFICATION]],
    },
    {
        "nmk_accession_no": "DEMO-004",
        "title": "DEMO: sample restricted item",
        "object_type": "Ceremonial",
        "materials": "Mixed materials (demo data)",
        "dims": ("410.0", "90.0", "90.0"),
        "restricted": True,
        "cultural_protocols": "Demo protocol text",
        "versions": [[S.PROCESSING, S.NEEDS_VERIFICATION, S.VERIFIED]],
    },
    {
        "nmk_accession_no": "DEMO-005",
        "title": "DEMO: sample iron tool",
        "object_type": "Tool",
        "materials": "Iron and wood (demo data)",
        "dims": ("200.0", "60.0", "40.0"),
        # v1 was replaced by v2, which was approved.
        "versions": [
            [S.PROCESSING, S.NEEDS_VERIFICATION, S.VERIFIED, S.SUPERSEDED],
            [S.PROCESSING, S.NEEDS_VERIFICATION, S.VERIFIED, S.APPROVED],
        ],
    },
]


class Command(BaseCommand):
    help = "Create 5 fake demo artefacts with captures and model versions (needs DEBUG or --force)."

    def add_arguments(self, parser):
        parser.add_argument("--email", help="Email of an existing user to use as created_by.")
        parser.add_argument(
            "--force", action="store_true", help="Run even when DEBUG is false."
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options["force"]:
            raise CommandError("Refusing to seed demo data while DEBUG is false. Use --force.")

        user = self._pick_user(options["email"])
        self.stdout.write(f"Using {user.get_username()} as created_by.")

        with transaction.atomic():
            for spec in DEMO_ARTEFACTS:
                self._seed_one(spec, user)

    def _pick_user(self, email):
        User = get_user_model()
        if email:
            user = User.objects.filter(email__iexact=email).order_by("pk").first()
            if user is None:
                raise CommandError(f"No user with email {email!r}. Create the user first.")
            return user
        user = (
            User.objects.filter(role=User.Role.ADMIN).order_by("pk").first()
            or User.objects.filter(is_superuser=True).order_by("pk").first()
        )
        if user is None:
            raise CommandError(
                "No admin user found. Create one first or pass --email of an existing user."
            )
        return user

    def _seed_one(self, spec, user):
        height, width, depth = (Decimal(d) for d in spec["dims"])
        # collection_status is deliberately absent: it starts as Draft and moves only
        # through transition_model().
        artefact, created = Artefact.objects.get_or_create(
            nmk_accession_no=spec["nmk_accession_no"],
            defaults={
                "title": spec["title"],
                "community": "Demo community",
                "object_type": spec["object_type"],
                "materials": spec["materials"],
                "height_mm": height,
                "width_mm": width,
                "depth_mm": depth,
                "restricted": spec.get("restricted", False),
                "cultural_protocols": spec.get("cultural_protocols", ""),
                "created_by": user,
            },
        )
        done = ["artefact created" if created else "artefact already existed"]

        if not artefact.captures.exists():
            Capture.objects.create(
                artefact=artefact, views={}, upload_complete=False, captured_by=user
            )
            done.append("capture created")

        if spec["versions"] and not artefact.versions.exists():
            for number, path in enumerate(spec["versions"], start=1):
                version = create_version(artefact, f"Demo version {number}", user)
                for status in path:
                    transition_model(version, status, reason="Demo seed data", actor=user)
            artefact.refresh_from_db()
            done.append(
                f"{len(spec['versions'])} version(s), artefact now {artefact.collection_status}"
            )

        self.stdout.write(f"{artefact.nmk_accession_no}: {', '.join(done)}")
