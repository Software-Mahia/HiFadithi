#!/usr/bin/env bash
# Owner: B. Nightly encrypted pg_dump over the Supabase connection pooler.
# Run by .github/workflows/backup.yml. Storage copy comes after day 6.
set -euo pipefail
echo "TODO (B): pg_dump \"$DATABASE_URL\" | age -r \"$BACKUP_PUBLIC_KEY\" > backup.sql.age"
