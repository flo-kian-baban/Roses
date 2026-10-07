#!/usr/bin/env bash
# Restores a dump made by db-backup.sh into the local Docker Postgres.
#   npm run db:restore -- <file> --into roses_restore_test   # into a scratch database (created if missing); the live db is untouched
#   npm run db:restore -- <file> --replace                   # replaces the live "roses" database after typing REPLACE
set -euo pipefail
cd "$(dirname "$0")/.."
CONTAINER="${ROSES_DB_CONTAINER:-roses-db}"
LIVE="${ROSES_DB:-roses}"
FILE="${1:-}"; shift || true
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "usage: db-restore.sh <dump file> (--into <dbname> | --replace)" >&2; exit 2; }
INTO=""; REPLACE=0
while [ $# -gt 0 ]; do case "$1" in --into) INTO="$2"; shift 2;; --replace) REPLACE=1; shift;; *) echo "unknown option $1" >&2; exit 2;; esac; done
if [ "$REPLACE" = "1" ]; then
  INTO="$LIVE"
  echo "This REPLACES the live database '$LIVE' with $FILE. Type REPLACE to continue:"; read -r ANSWER
  [ "$ANSWER" = "REPLACE" ] || { echo "aborted"; exit 1; }
  docker exec "$CONTAINER" psql -U roses -d postgres -v ON_ERROR_STOP=1 -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$LIVE' and pid <> pg_backend_pid();" > /dev/null
  docker exec "$CONTAINER" psql -U roses -d postgres -v ON_ERROR_STOP=1 -c "drop database \"$LIVE\";" -c "create database \"$LIVE\";"
else
  [ -n "$INTO" ] || { echo "choose --into <dbname> or --replace" >&2; exit 2; }
  [ "$INTO" != "$LIVE" ] || { echo "use --replace to overwrite the live database" >&2; exit 2; }
  docker exec "$CONTAINER" psql -U roses -d postgres -tAc "select 1 from pg_database where datname = '$INTO'" | grep -q 1 || docker exec "$CONTAINER" psql -U roses -d postgres -v ON_ERROR_STOP=1 -c "create database \"$INTO\";"
  docker exec "$CONTAINER" psql -U roses -d "$INTO" -v ON_ERROR_STOP=1 -c "drop schema public cascade; create schema public;" > /dev/null
fi
docker exec -i "$CONTAINER" pg_restore -U roses -d "$INTO" --no-owner --no-privileges --exit-on-error < "$FILE"
echo "restored $FILE into database '$INTO'"
docker exec "$CONTAINER" psql -U roses -d "$INTO" -c "select 'venues' as t, count(*) from venues union all select 'sections', count(*) from sections union all select 'items', count(*) from items union all select 'item_sections', count(*) from item_sections union all select 'revisions', count(*) from revisions union all select 'admins', count(*) from admins union all select 'pins', count(*) from pins order by 1;"
