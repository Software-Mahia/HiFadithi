import pytest
from django.db import IntegrityError, transaction

from access.models import ArtefactAccess
from access.selectors import visible_artefacts
from accounts.models import User
from artefacts.models import Artefact

pytestmark = pytest.mark.django_db


def make_user(username, role=User.Role.RESEARCHER, is_active=True):
    return User.objects.create_user(
        username=username, password="x-long-password-1", role=role, is_active=is_active
    )


def make_artefact(no, restricted=False):
    return Artefact.objects.create(nmk_accession_no=no, title="Emedot", restricted=restricted)


def test_non_restricted_artefact_is_visible_to_any_active_user():
    art = make_artefact("NMK-OPEN")
    user = make_user("researcher")
    assert list(visible_artefacts(user)) == [art]


def test_restricted_artefact_is_hidden_without_a_grant():
    make_artefact("NMK-SECRET", restricted=True)
    user = make_user("researcher")
    assert list(visible_artefacts(user)) == []


def test_restricted_artefact_is_visible_with_a_user_grant():
    art = make_artefact("NMK-SECRET", restricted=True)
    user = make_user("researcher")
    ArtefactAccess.objects.create(artefact=art, user=user)
    assert list(visible_artefacts(user)) == [art]


def test_restricted_artefact_is_visible_with_a_role_grant():
    art = make_artefact("NMK-SECRET", restricted=True)
    curator = make_user("curator", role=User.Role.CURATOR)
    ArtefactAccess.objects.create(artefact=art, role=User.Role.CURATOR)
    assert list(visible_artefacts(curator)) == [art]


def test_a_grant_for_another_user_does_not_leak():
    art = make_artefact("NMK-SECRET", restricted=True)
    owner = make_user("owner")
    other = make_user("other")
    ArtefactAccess.objects.create(artefact=art, user=owner)
    assert list(visible_artefacts(other)) == []


def test_empty_role_does_not_leak_user_grants():
    # A user grant stores role="". A user whose own role is "" must not match those rows.
    art = make_artefact("NMK-SECRET", restricted=True)
    owner = make_user("owner")
    ArtefactAccess.objects.create(artefact=art, user=owner)
    stranger = make_user("stranger")
    stranger.role = ""
    stranger.save(update_fields=["role"])
    assert list(visible_artefacts(stranger)) == []


def test_admin_is_not_exempt_from_restriction():
    make_artefact("NMK-SECRET", restricted=True)
    admin = make_user("admin", role=User.Role.ADMIN)
    assert list(visible_artefacts(admin)) == []


def test_inactive_user_sees_nothing():
    make_artefact("NMK-OPEN")
    inactive = make_user("gone", is_active=False)
    assert list(visible_artefacts(inactive)) == []


def test_grant_needs_exactly_one_of_user_or_role():
    art = make_artefact("NMK-SECRET", restricted=True)
    user = make_user("researcher")
    # Both set: refused.
    with pytest.raises(IntegrityError), transaction.atomic():
        ArtefactAccess.objects.create(artefact=art, user=user, role=User.Role.RESEARCHER)
    # Neither set: refused.
    with pytest.raises(IntegrityError), transaction.atomic():
        ArtefactAccess.objects.create(artefact=art)


def test_a_user_grant_is_unique_per_artefact():
    art = make_artefact("NMK-SECRET", restricted=True)
    user = make_user("researcher")
    ArtefactAccess.objects.create(artefact=art, user=user)
    with pytest.raises(IntegrityError), transaction.atomic():
        ArtefactAccess.objects.create(artefact=art, user=user)
