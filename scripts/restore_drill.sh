#!/usr/bin/env bash
# Restore drill for the LOCAL Docker Postgres (container hifadithi-db).
# Restores a backup into a throwaway database (hifadithi_restore_drill),
# compares exact row counts with the live db, then drops it. The live "hifadithi" db is only read, never modified.
# Usage: scripts/restore_drill.sh [path/to/backup.dump]   (default: newest in backups/)
set -euo pipefail

CONTAINER="hifadithi-db"
PGUSER="postgres"
SCRATCH_DB="hifadithi_restore_drill"
LIVE_DB="hifadithi"   # read-only SELECTs only (table list + count(*)); never DROP/CREATE/restore

cd "$(dirname "$0")/.."

FILE="${1:-}"
if [ -z "$FILE" ]; then
  FILE="$(ls -1t backups/*.dump 2>/dev/null | head -n1 || true)"
fi
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "ERROR: no backup file found. Run scripts/backup_db.sh first." >&2
  exit 1
fi

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  echo "ERROR: container $CONTAINER is not running." >&2
  exit 1
fi

psql_c() { docker exec "$CONTAINER" psql -U "$PGUSER" -v ON_ERROR_STOP=1 "$@"; }

cleanup() { psql_c -d postgres -qc "DROP DATABASE IF EXISTS $SCRATCH_DB;" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "Drill using: $FILE"
cleanup
psql_c -d postgres -qc "CREATE DATABASE $SCRATCH_DB;"

docker exec -i "$CONTAINER" pg_restore -U "$PGUSER" -d "$SCRATCH_DB" --no-owner --exit-on-error < "$FILE"

# Live db access is forced read-only at the session level as a safety net.
live_psql() {
  docker exec -e PGOPTIONS="-c default_transaction_read_only=on" "$CONTAINER" \
    psql -U "$PGUSER" -v ON_ERROR_STOP=1 -d "$LIVE_DB" "$@"
}

TABLE_LIST="$(live_psql -Atc "select tablename from pg_tables where schemaname='public' order by 1" | tr -d '\r')"
if [ -z "$TABLE_LIST" ]; then
  echo "DRILL FAILED: live database has no tables in schema public." >&2
  exit 1
fi

echo "--- Exact row counts: live vs restored ---"
printf '%-40s %12s %12s\n' "table" "live" "scratch"

N=0
BAD=""
while IFS= read -r t; do
  [ -n "$t" ] || continue
  N=$((N + 1))
  live_n="$(live_psql -Atc "SELECT count(*) FROM public.\"$t\";" | tr -d '\r')"
  if scratch_n="$(psql_c -d "$SCRATCH_DB" -Atc "SELECT count(*) FROM public.\"$t\";" 2>/dev/null | tr -d '\r')" \
     && [ -n "$scratch_n" ]; then
    :
  else
    scratch_n="MISSING"
  fi
  printf '%-40s %12s %12s\n' "$t" "$live_n" "$scratch_n"
  if [ "$live_n" != "$scratch_n" ]; then
    BAD="${BAD}${t} (live=${live_n}, scratch=${scratch_n})"$'\n'
  fi
done <<< "$TABLE_LIST"

if [ -n "$BAD" ]; then
  echo "DRILL FAILED: mismatched or missing tables:" >&2
  printf '%s' "$BAD" >&2
  exit 1
fi

echo "RESTORE DRILL PASSED: $N tables, counts match"
