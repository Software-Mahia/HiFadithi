#!/usr/bin/env bash
# Owner: B. Restore drill: decrypt last night's backup into a fresh database.
set -euo pipefail
echo "TODO (B): age -d -i key.txt backup.sql.age | psql \"$RESTORE_DATABASE_URL\""
