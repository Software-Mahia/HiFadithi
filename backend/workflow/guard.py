"""The status guard. Owner: D.

The workflow rule: review_status, is_current and collection_status change ONLY
through transition_model() (and create_version()). Two layers enforce it:

1. Python layer: ProtectedFieldsMixin on the model refuses save() calls that change a
   protected field outside allow_status_change(). Catches ordinary model code.
2. Database layer: a Postgres trigger refuses ANY update to a protected column
   (including QuerySet.update(), raw SQL and the admin) unless the current transaction
   has set app.in_transition = 'on', which only allow_status_change() does.

Usage inside workflow/services.py:

    with allow_status_change():
        version.review_status = "approved"
        version.save(update_fields=["review_status"])

This module must not import any models, so artefacts/models.py can import the mixin.
"""
import contextvars
from contextlib import contextmanager

from django.db import connection, migrations, transaction

_allowed = contextvars.ContextVar("hifadithi_status_change_allowed", default=False)


class ProtectedFieldChanged(Exception):
    """A protected field was changed outside transition_model()."""


@contextmanager
def allow_status_change():
    """Open a transaction in which protected fields may change. Only workflow services use it."""
    with transaction.atomic():
        _set_db_flag("on")
        token = _allowed.set(True)
        try:
            yield
        finally:
            _allowed.reset(token)
            _set_db_flag("off")


def status_change_allowed() -> bool:
    return _allowed.get()


def _set_db_flag(value: str) -> None:
    if connection.vendor == "postgresql":
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.in_transition', %s, true)", [value])


class ProtectedFieldsMixin:
    """Add to a model and list the fields in PROTECTED_FIELDS.

    New rows must start with each protected field at its default value.
    Existing rows may only change a protected field inside allow_status_change().
    """

    PROTECTED_FIELDS: tuple[str, ...] = ()

    @classmethod
    def from_db(cls, db, field_names, values):
        instance = super().from_db(db, field_names, values)
        instance._protected_loaded = {
            name: getattr(instance, name) for name in cls.PROTECTED_FIELDS if name in field_names
        }
        return instance

    def save(self, *args, **kwargs):
        if self.PROTECTED_FIELDS and not status_change_allowed():
            if self._state.adding:
                for name in self.PROTECTED_FIELDS:
                    default = self._meta.get_field(name).get_default()
                    if getattr(self, name) != default:
                        raise ProtectedFieldChanged(
                            f"New {type(self).__name__} must start with {name}={default!r}; "
                            "change it through transition_model()."
                        )
            else:
                loaded = getattr(self, "_protected_loaded", {})
                for name, old in loaded.items():
                    if getattr(self, name) != old:
                        raise ProtectedFieldChanged(
                            f"{type(self).__name__}.{name} can only change through "
                            "transition_model()."
                        )
        super().save(*args, **kwargs)
        self._protected_loaded = {name: getattr(self, name) for name in self.PROTECTED_FIELDS}


# ---------- database layer (Postgres only)

GUARD_FUNCTION_SQL = """
CREATE OR REPLACE FUNCTION hifadithi_guard_protected_columns() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    col text;
BEGIN
    IF coalesce(current_setting('app.in_transition', true), 'off') = 'on' THEN
        RETURN NEW;
    END IF;
    FOREACH col IN ARRAY TG_ARGV LOOP
        IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
            RAISE EXCEPTION '%.% can only change through transition_model()', TG_TABLE_NAME, col
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END LOOP;
    RETURN NEW;
END;
$$;
"""


def guard_trigger_sql(table: str, columns: list[str]) -> tuple[str, str]:
    """SQL to add and remove the guard trigger on one table."""
    args = ", ".join(f"'{c}'" for c in columns)
    name = f"{table}_status_guard"
    create = (
        f"DROP TRIGGER IF EXISTS {name} ON {table}; "
        f"CREATE TRIGGER {name} BEFORE UPDATE ON {table} FOR EACH ROW "
        f"EXECUTE FUNCTION hifadithi_guard_protected_columns({args});"
    )
    drop = f"DROP TRIGGER IF EXISTS {name} ON {table};"
    return create, drop


def guard_operations(guards: dict[str, list[str]]) -> list:
    """Migration operations that install the guard. Skipped on non-Postgres databases.

    Example, in a workflow migration that depends on the artefacts and workflow models:

        operations = guard_operations({
            "workflow_modelversion": ["review_status", "is_current"],
            "artefacts_artefact": ["collection_status"],
        })
    """

    def forwards(apps, schema_editor):
        if schema_editor.connection.vendor != "postgresql":
            return
        schema_editor.execute(GUARD_FUNCTION_SQL)
        for table, columns in guards.items():
            schema_editor.execute(guard_trigger_sql(table, columns)[0])

    def backwards(apps, schema_editor):
        if schema_editor.connection.vendor != "postgresql":
            return
        for table, columns in guards.items():
            schema_editor.execute(guard_trigger_sql(table, columns)[1])

    return [migrations.RunPython(forwards, backwards)]
