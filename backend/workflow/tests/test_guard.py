"""Proves the status guard works. Runs on SQLite (Python layer) and Postgres (both layers)."""
import pytest
from django.db import DatabaseError, connection, models, transaction

from workflow.guard import (
    GUARD_FUNCTION_SQL,
    ProtectedFieldChanged,
    ProtectedFieldsMixin,
    allow_status_change,
    guard_trigger_sql,
)


class GuardedThing(ProtectedFieldsMixin, models.Model):
    """A stand-in for ModelVersion / Artefact, only used by these tests."""

    PROTECTED_FIELDS = ("status",)
    status = models.CharField(max_length=20, default="draft")
    note = models.CharField(max_length=50, blank=True)

    class Meta:
        app_label = "workflow"
        db_table = "test_guarded_thing"


@pytest.fixture
def guarded_table(transactional_db):
    with connection.schema_editor() as editor:
        editor.create_model(GuardedThing)
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute(GUARD_FUNCTION_SQL)
            cursor.execute(guard_trigger_sql("test_guarded_thing", ["status"])[0])
    yield
    with connection.schema_editor() as editor:
        editor.delete_model(GuardedThing)


def test_new_row_must_start_at_default(guarded_table):
    with pytest.raises(ProtectedFieldChanged):
        GuardedThing.objects.create(status="approved")


def test_other_fields_can_change_freely(guarded_table):
    thing = GuardedThing.objects.create()
    thing.note = "edited"
    thing.save()


def test_save_cannot_change_status_directly(guarded_table):
    thing = GuardedThing.objects.create()
    thing.status = "approved"
    with pytest.raises(ProtectedFieldChanged):
        thing.save()


def test_status_changes_inside_allow_status_change(guarded_table):
    thing = GuardedThing.objects.create()
    with allow_status_change():
        thing.status = "approved"
        thing.save()
    thing.refresh_from_db()
    assert thing.status == "approved"


@pytest.mark.skipif(connection.vendor != "postgresql", reason="database trigger is Postgres only")
def test_database_blocks_queryset_update(guarded_table):
    thing = GuardedThing.objects.create()
    with pytest.raises(DatabaseError), transaction.atomic():
        GuardedThing.objects.filter(pk=thing.pk).update(status="approved")


@pytest.mark.skipif(connection.vendor != "postgresql", reason="database trigger is Postgres only")
def test_database_allows_update_inside_allow_status_change(guarded_table):
    thing = GuardedThing.objects.create()
    with allow_status_change():
        GuardedThing.objects.filter(pk=thing.pk).update(status="approved")
    thing.refresh_from_db()
    assert thing.status == "approved"


@pytest.mark.skipif(connection.vendor != "postgresql", reason="database trigger is Postgres only")
def test_flag_is_off_again_after_the_block(guarded_table):
    thing = GuardedThing.objects.create()
    with transaction.atomic():
        with allow_status_change():
            pass
        with pytest.raises(DatabaseError), transaction.atomic():
            GuardedThing.objects.filter(pk=thing.pk).update(status="approved")
