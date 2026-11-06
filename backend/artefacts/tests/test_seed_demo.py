import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command

from artefacts.models import Artefact, Capture
from workflow.guard import status_change_allowed
from workflow.models import ModelVersion

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin(db):
    User = get_user_model()
    return User.objects.create_user(
        username="demo-admin", email="admin@example.com", password="x", role="admin"
    )


@pytest.fixture(autouse=True)
def debug_on(settings):
    settings.DEBUG = True


def test_creates_five_demo_artefacts(admin):
    call_command("seed_demo")
    artefacts = Artefact.objects.order_by("nmk_accession_no")
    assert [a.nmk_accession_no for a in artefacts] == [f"DEMO-00{i}" for i in range(1, 6)]
    assert all(a.title.startswith("DEMO: ") for a in artefacts)
    assert all(a.community == "Demo community" for a in artefacts)
    assert all(a.created_by == admin for a in artefacts)
    assert all(a.height_mm > 0 and a.width_mm > 0 and a.depth_mm > 0 for a in artefacts)
    restricted = artefacts.filter(restricted=True)
    assert restricted.count() == 1
    assert restricted.get().cultural_protocols == "Demo protocol text"


def test_one_empty_capture_per_artefact(admin):
    call_command("seed_demo")
    assert Capture.objects.count() == 5
    assert all(c.views == {} and not c.upload_complete for c in Capture.objects.all())


def test_versions_have_a_spread_of_states(admin):
    call_command("seed_demo")
    statuses = set(ModelVersion.objects.values_list("review_status", flat=True))
    assert {"processing", "needs_verification", "verified", "superseded", "approved"} <= statuses
    assert Artefact.objects.filter(collection_status="draft").exists()
    assert Artefact.objects.get(nmk_accession_no="DEMO-005").collection_status == "in_collection"


def test_second_run_creates_nothing_new(admin):
    call_command("seed_demo")
    counts = (Artefact.objects.count(), Capture.objects.count(), ModelVersion.objects.count())
    call_command("seed_demo")
    assert (
        Artefact.objects.count(), Capture.objects.count(), ModelVersion.objects.count()
    ) == counts


def test_refuses_without_any_user():
    with pytest.raises(CommandError, match="No admin user"):
        call_command("seed_demo")
    assert Artefact.objects.count() == 0


def test_email_picks_that_user(admin):
    other = get_user_model().objects.create_user(
        username="res", email="res@example.com", password="x"
    )
    call_command("seed_demo", email="res@example.com")
    assert Artefact.objects.filter(created_by=other).count() == 5


def test_unknown_email_stops(admin):
    with pytest.raises(CommandError, match="No user with email"):
        call_command("seed_demo", email="nobody@example.com")
    assert Artefact.objects.count() == 0


def test_refuses_when_debug_is_false_unless_forced(admin, settings):
    settings.DEBUG = False
    with pytest.raises(CommandError, match="DEBUG"):
        call_command("seed_demo")
    assert Artefact.objects.count() == 0
    call_command("seed_demo", force=True)
    assert Artefact.objects.count() == 5


def test_prints_what_it_created(admin, capsys):
    call_command("seed_demo")
    out = capsys.readouterr().out
    assert "DEMO-005" in out and "artefact created" in out


def test_collection_status_only_changes_inside_transition_model(admin, monkeypatch):
    """Every save that touches collection_status must run inside allow_status_change()."""
    unguarded = []
    original_save = Artefact.save

    def watching_save(self, *args, **kwargs):
        fields = kwargs.get("update_fields")
        if (fields is None or "collection_status" in fields) and not self._state.adding:
            if not status_change_allowed():
                unguarded.append(self.nmk_accession_no)
        return original_save(self, *args, **kwargs)

    monkeypatch.setattr(Artefact, "save", watching_save)
    call_command("seed_demo")
    assert unguarded == []
