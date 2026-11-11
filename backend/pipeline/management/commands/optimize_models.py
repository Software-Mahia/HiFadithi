"""Shrink the textures of 3D models that are already stored. Owner: C.

New models are optimised as they are saved (pipeline.model_files.copy_model). This
command applies the same optimisation to models stored before that existed:

    python manage.py optimize_models            # optimise every stored model
    python manage.py optimize_models --dry-run  # report savings, change nothing

Each file is rewritten in place at the same path, so the app's model URL does not
change. A model whose optimised copy does not read back cleanly is left untouched.
"""
from django.core.management.base import BaseCommand

from artefacts.models import Model3D
from core import storage
from core.storage import MODELS_BUCKET
from pipeline.glb import GlbError, read_glb_info
from pipeline.textures import optimize_glb


class Command(BaseCommand):
    help = "Re-encode embedded textures of stored GLB models so they load faster."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Report only; do not rewrite files."
        )

    def handle(self, *args, dry_run=False, **options):
        total_before = total_after = changed = 0
        for model in Model3D.objects.select_related("artefact").order_by("pk"):
            label = f"{model.artefact.nmk_accession_no} ({model.glb_path})"
            try:
                body, *_ = storage.open_stream(MODELS_BUCKET, model.glb_path)
                try:
                    data = b"".join(body)
                finally:
                    close = getattr(body, "close", None)
                    if close:
                        close()
            except (FileNotFoundError, RuntimeError) as exc:
                self.stdout.write(self.style.WARNING(f"skip {label}: file missing ({exc})"))
                continue

            optimised, report = optimize_glb(data)
            total_before += report.before_bytes
            total_after += report.after_bytes
            if not report.images_changed:
                self.stdout.write(f"keep {label}: already small ({report.before_bytes:,} bytes)")
                continue
            try:
                read_glb_info(optimised)
            except GlbError as exc:
                warning = f"skip {label}: optimised copy unreadable ({exc})"
                self.stdout.write(self.style.WARNING(warning))
                continue

            changed += 1
            self.stdout.write(
                f"{'would shrink' if dry_run else 'shrunk'} {label}: "
                f"{report.before_bytes:,} -> {report.after_bytes:,} bytes "
                f"({report.images_changed} textures)"
            )
            if not dry_run:
                storage.save_bytes(MODELS_BUCKET, model.glb_path, optimised, "model/gltf-binary")
                Model3D.objects.filter(pk=model.pk).update(size_bytes=report.after_bytes)

        verb = "Would save" if dry_run else "Saved"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {total_before - total_after:,} bytes across {changed} model(s) "
                f"({total_before:,} -> {total_after:,})."
            )
        )
