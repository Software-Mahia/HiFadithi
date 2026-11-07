#!/usr/bin/env bash
# Entry point shared by the web and worker containers (ported from the MVP).
set -euo pipefail

role="${1:-web}"

# Wait for Postgres, then run migrations while holding a Postgres advisory lock.
# The web and worker containers start together; without the lock they race on
# CREATE TABLE.
migrate_database() {
    python - <<'PY'
import os
import subprocess
import sys
import time

import psycopg

url = os.environ.get("DATABASE_URL", "")
is_postgres = url.startswith(("postgres://", "postgresql://"))

if not is_postgres:
    subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"], check=True)
    sys.exit(0)

for attempt in range(1, 31):
    try:
        connection = psycopg.connect(url, connect_timeout=3)
        break
    except Exception as exc:  # noqa: BLE001 - report and retry
        print(f"waiting for database ({attempt}/30): {exc}")
        time.sleep(2)
else:
    print("database did not become ready in time", file=sys.stderr)
    sys.exit(1)

print("database is ready")
connection.autocommit = True
try:
    with connection.cursor() as cursor:
        # Constant shared by every HiFadithi container.
        cursor.execute("SELECT pg_advisory_lock(47110815)")
    subprocess.run([sys.executable, "manage.py", "migrate", "--noinput"], check=True)
finally:
    connection.close()
PY
}

migrate_database
python manage.py setup_roles   # researcher/curator/admin groups kept in step

# First admin account, from DJANGO_SUPERUSER_* (created once, skipped afterwards).
if [ -n "${DJANGO_SUPERUSER_USERNAME:-}" ]; then
    python manage.py createsuperuser --no-input || echo "Admin account already exists, skipping."
fi

case "$role" in
    web)
        python manage.py collectstatic --noinput
        exec gunicorn config.wsgi:application \
            --bind "0.0.0.0:${PORT:-8000}" \
            --workers "${WEB_CONCURRENCY:-2}" \
            --threads "${WEB_THREADS:-2}" \
            --timeout "${WEB_TIMEOUT:-120}" \
            --access-logfile - \
            --error-logfile -
        ;;
    worker)
        exec python manage.py qcluster
        ;;
    *)
        exec "$@"
        ;;
esac
