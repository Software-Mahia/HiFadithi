# Hand written. Owner: D.
#
# Installs the database layer of the status guard (see workflow/guard.py): on
# Postgres, review_status, is_current and collection_status can change only inside
# allow_status_change(), which workflow/services.py opens when transition_model()
# runs. On non-Postgres databases these operations do nothing; the Python-level
# ProtectedFieldsMixin still enforces the rule.

import workflow.guard  # noqa: F401
from django.db import migrations

from workflow.guard import guard_operations


class Migration(migrations.Migration):

    dependencies = [
        ("workflow", "0001_initial"),
    ]

    operations = guard_operations(
        {
            "workflow_modelversion": ["review_status", "is_current"],
            "artefacts_artefact": ["collection_status"],
        }
    )
