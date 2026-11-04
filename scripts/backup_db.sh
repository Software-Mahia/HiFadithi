#!/usr/bin/env bash
# Back up the LOCAL Docker Postgres (container hifadithi-pg, db hifadithi).
# Uses the container's trusted local socket: no password needed.
# Output: backups/hifadithi_<UTC timestamp>.dump (pg_dump custom format).
set -euo pipefail

CONTAINER="hifadithi-pg"
PGUSER="postgres"
DB="hifadithi"

cd "$(dirname "$0")/.."
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  echo "ERROR: container $CONTAINER is not running." >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/${DB}_${STAMP}.dump"
TMP="$OUT.partial"
trap 'rm -f "$TMP"' EXIT

docker exec "$CONTAINER" pg_dump -U "$PGUSER" -d "$DB" -Fc > "$TMP"

# Verify the archive is readable before keeping it.
docker exec -i "$CONTAINER" pg_restore -l < "$TMP" > /dev/null

mv "$TMP" "$OUT"

# Retention: keep the newest 7 dumps, delete older ones. The glob is deliberately
# limited to "$BACKUP_DIR/${DB}_*.dump" so we never touch other databases' dumps,
# in-progress .partial files, or anything else that lives in the backups dir.
# Timestamps are UTC and fixed-width, so glob (lexicographic) order is oldest-first.
DUMPS=("$BACKUP_DIR/${DB}_"*.dump)
if (( ${#DUMPS[@]} > 7 )); then
  rm -f -- "${DUMPS[@]:0:${#DUMPS[@]}-7}"
fi

echo "Backup OK: $OUT ($(wc -c < "$OUT") bytes)"
