"""Keep each user's admin access in step with their role. Owner: A."""
from django.contrib.auth.models import Group
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import User


@receiver(post_save, sender=User)
def sync_role_group(sender, instance, **kwargs):
    role_groups = Group.objects.filter(name__in=[r.value for r in User.Role])
    instance.groups.remove(*role_groups)
    group = role_groups.filter(name=instance.role).first()
    if group:
        instance.groups.add(group)
