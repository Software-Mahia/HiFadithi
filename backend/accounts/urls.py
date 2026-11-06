"""URLs for accounts. Owner: A. Included under /api/accounts/."""
from django.urls import path

from .views import DeactivateUserView, InviteStaffView, MeView

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("invite/", InviteStaffView.as_view(), name="invite-staff"),
    path("<int:user_id>/deactivate/", DeactivateUserView.as_view(), name="deactivate-user"),
]
