#!/usr/bin/env bash
# pg_dump of the local Docker Postgres into backups/ (gitignored). Uses the pg_dump inside the container, so the
# client version always matches the server. Output: backups/roses-<UTC timestamp>.dump (custom format).
#   npm run db:backup            -> backups/roses-YYYYMMDDTHHMMSSZ.dump
#   npm run db:backup -- --out x -> a chosen path
#   npm run db:backup -- --for-hosting -> backups/roses-hosting-YYYYMMDDTHHMMSSZ.dump, the copy for the hosted database (the PM,
#     2026-11-06, docs/runbook.md, Deploy steps): its sign-in failures (login_failures) and alerts (admin_alerts) left empty, their
#     tables kept; the working database keeps its own rows
set -euo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${ROSES_DB_CONTAINER:-roses-db}"
DB="${ROSES_DB:-roses}"          # the check suite sets ROSES_DB to its scratch copy
OUT=""; HOSTING=""
while [ $# -gt 0 ]; do case "$1" in --out) OUT="$2"; shift 2;; --for-hosting) HOSTING=1; shift;; *) echo "unknown option $1" >&2; exit 2;; esac; done
EMPTY=(); [ -n "$HOSTING" ] && EMPTY=(--exclude-table-data=login_failures --exclude-table-data=admin_alerts)
mkdir -p backups
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUT:-backups/${DB}${HOSTING:+-hosting}-${STAMP}.dump}"
mkdir -p "$(dirname "$OUT")"
docker exec "$CONTAINER" pg_dump -U roses -d "$DB" --format=custom --no-owner --no-privileges ${EMPTY[@]+"${EMPTY[@]}"} > "$OUT"
SIZE=$(wc -c < "$OUT" | tr -d ' ')
echo "backup written: $OUT ($SIZE bytes)"
docker exec -i "$CONTAINER" pg_restore --list < "$OUT" | grep -c 'TABLE DATA' | sed 's/^/tables with data in the dump: /'
if [ -n "$HOSTING" ]; then
  LEFT=$(docker exec -i "$CONTAINER" pg_restore --list < "$OUT" | grep 'TABLE DATA' | grep -cE ' (login_failures|admin_alerts) ' || true)
  echo "for hosting: login_failures and admin_alerts left empty (their data in the dump: $LEFT entries, must be 0); no session is stored in the database"
  [ "$LEFT" = "0" ] || { echo "the dump still carries sign-in failures or alerts" >&2; exit 1; }
fi
