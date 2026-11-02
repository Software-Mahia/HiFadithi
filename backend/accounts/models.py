"""Custom user model. Owner: A. Must be merged BEFORE anyone runs makemigrations."""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        RESEARCHER = "researcher", "Researcher"
        CURATOR = "curator", "Curator"
        ADMIN = "admin", "Admin"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.RESEARCHER)
    department = models.CharField(max_length=100, blank=True)

    def save(self, *args, **kwargs):
        # Every active staff member can open Django admin (our demo screens);
        # what they see there is limited by their role's group (setup_roles).
        self.is_staff = self.is_active
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"
