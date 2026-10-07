#!/usr/bin/env bash
# pg_dump of the local Docker Postgres into backups/ (gitignored). Uses the pg_dump inside the container, so the
# client version always matches the server. Output: backups/roses-<UTC timestamp>.dump (custom format).
#   npm run db:backup            -> backups/roses-YYYYMMDDTHHMMSSZ.dump
#   npm run db:backup -- --out x -> a chosen path
set -euo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${ROSES_DB_CONTAINER:-roses-db}"
DB="${ROSES_DB:-roses}"          # the check suite sets ROSES_DB to its scratch copy
OUT=""
while [ $# -gt 0 ]; do case "$1" in --out) OUT="$2"; shift 2;; *) echo "unknown option $1" >&2; exit 2;; esac; done
mkdir -p backups
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT:-backups/${DB}-${STAMP}.dump}"
mkdir -p "$(dirname "$OUT")"
docker exec "$CONTAINER" pg_dump -U roses -d "$DB" --format=custom --no-owner --no-privileges > "$OUT"
SIZE=$(wc -c < "$OUT" | tr -d ' ')
echo "backup written: $OUT ($SIZE bytes)"
docker exec -i "$CONTAINER" pg_restore --list < "$OUT" | grep -c 'TABLE DATA' | sed 's/^/tables with data in the dump: /'
