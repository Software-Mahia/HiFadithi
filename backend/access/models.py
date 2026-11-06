"""Models for access. Owner: A.

ArtefactAccess, visible_artefacts(), delete_person_data(); remove_capture_photos() after day 6.
"""
from django.conf import settings
from django.db import models
from django.db.models import Q

from accounts.models import User


class ArtefactAccess(models.Model):
    """A grant that lets a user, or everyone with a role, see one restricted artefact.

    BR-12: a restricted artefact is visible only to the users or roles listed here. A grant
    names exactly one of `user` or `role`. Non-restricted artefacts need no row.
    """

    artefact = models.ForeignKey(
        "artefacts.Artefact", on_delete=models.CASCADE, related_name="access_grants"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.CASCADE, related_name="artefact_grants",
    )
    role = models.CharField(max_length=20, choices=User.Role.choices, blank=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="+",
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # Exactly one of user / role is set (role is stored as "" when unset).
            models.CheckConstraint(
                condition=(
                    (Q(user__isnull=False) & Q(role=""))
                    | (Q(user__isnull=True) & ~Q(role=""))
                ),
                name="artefactaccess_user_xor_role",
            ),
            models.UniqueConstraint(
                fields=["artefact", "user"],
                condition=Q(user__isnull=False),
                name="artefactaccess_unique_artefact_user",
            ),
            models.UniqueConstraint(
                fields=["artefact", "role"],
                condition=~Q(role=""),
                name="artefactaccess_unique_artefact_role",
            ),
        ]

    def __str__(self):
        who = self.user_id or f"role={self.role}"
        return f"access({self.artefact_id} -> {who})"
