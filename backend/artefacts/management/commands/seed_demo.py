"""python manage.py seed_demo. Owner: B. Grows as each app's models merge."""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Load demo users, artefacts, a capture and a sample model."

    def handle(self, *args, **options):
        self.stdout.write("TODO (B): one user per role, 5 artefacts, 1 capture, 1 sample model")
