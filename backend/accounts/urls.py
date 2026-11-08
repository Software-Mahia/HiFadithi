"""URLs for accounts. Owner: A. Included under /api/accounts/."""
from django.urls import path

from .views import (
    AcceptInviteView,
    ChangeRoleView,
    DeactivateUserView,
    InviteStaffView,
    MeView,
)

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("invite/", InviteStaffView.as_view(), name="invite-staff"),
    path("invite/accept/", AcceptInviteView.as_view(), name="invite-accept"),
    path("<int:user_id>/role/", ChangeRoleView.as_view(), name="change-role"),
    path("<int:user_id>/deactivate/", DeactivateUserView.as_view(), name="deactivate-user"),
]
