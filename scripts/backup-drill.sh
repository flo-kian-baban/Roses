#!/usr/bin/env bash
# T7 drill: backup, restore into a scratch database, compare per-table counts, delete an item on purpose,
# recover it from the restored copy, drop the scratch database. Output: the log path given as $1.
# ROSES_DB (default roses) is the database drilled; BACKUP_DIR (default backups) is where the dump goes.
# The check suite runs this against its own scratch copy, never against the working database.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-reports/checkpoint-b/backup-drill.txt}"
C="${ROSES_DB_CONTAINER:-roses-db}"
DB="${ROSES_DB:-roses}"
SCRATCH="${DB}_restore_test"
DUMPDIR="${BACKUP_DIR:-backups}"
Q() { docker exec "$C" psql -U roses -d "$1" -tAc "$2"; }
{
  echo "# Backup and restore drill — $(date -u +%Y-%m-%dT%H:%M:%SZ) — database $DB"
  echo; echo "## 1. db-backup.sh"; FILE="$DUMPDIR/${DB}-$(date -u +%Y%m%dT%H%M%SZ).dump"; bash scripts/db-backup.sh --out "$FILE"
  echo "dump: $FILE ($(wc -c < "$FILE" | tr -d ' ') bytes)"
  echo; echo "## 2. restore into the scratch database $SCRATCH"; ROSES_DB="$DB" bash scripts/db-restore.sh "$FILE" --into "$SCRATCH"
  echo; echo "## 3. per-table row counts, $DB vs restored"
  for t in venues sections items item_sections revisions admins pins login_failures admin_alerts schema_migrations; do L=$(Q "$DB" "select count(*) from $t"); R=$(Q "$SCRATCH" "select count(*) from $t"); printf '%-18s live=%-6s restored=%-6s %s\n' "$t" "$L" "$R" "$([ "$L" = "$R" ] && echo equal || echo DIFFERENT)"; done
  echo; echo "## 4. delete an item on purpose (SQL, bypassing the admin) and recover it from the dump"
  ID=$(Q "$DB" "select id from items where venue_id='kebab-land' and name->>'en'='Soft Drink'")
  echo "item: Soft Drink (kebab-land) id=$ID; placements before: $(Q "$DB" "select count(*) from item_sections where item_id='$ID'")"
  docker exec "$C" psql -U roses -d "$DB" -c "delete from items where id='$ID';"
  echo "after delete: items with that id = $(Q "$DB" "select count(*) from items where id='$ID'"), placements = $(Q "$DB" "select count(*) from item_sections where item_id='$ID'")"
  docker exec "$C" psql -U roses -d "$SCRATCH" -c "copy (select * from items where id='$ID') to stdout" | docker exec -i "$C" psql -U roses -d "$DB" -c "copy items from stdin"
  docker exec "$C" psql -U roses -d "$SCRATCH" -c "copy (select * from item_sections where item_id='$ID') to stdout" | docker exec -i "$C" psql -U roses -d "$DB" -c "copy item_sections from stdin"
  echo "after recovery: items with that id = $(Q "$DB" "select count(*) from items where id='$ID'"), placements = $(Q "$DB" "select count(*) from item_sections where item_id='$ID'"), name = $(Q "$DB" "select name->>'en' from items where id='$ID'"), price = $(Q "$DB" "select price from items where id='$ID'")"
  echo; echo "## 5. counts equal again?"
  for t in items item_sections; do L=$(Q "$DB" "select count(*) from $t"); R=$(Q "$SCRATCH" "select count(*) from $t"); printf '%-18s live=%-6s restored=%-6s %s\n' "$t" "$L" "$R" "$([ "$L" = "$R" ] && echo equal || echo DIFFERENT)"; done
  echo; echo "## 6. drop the scratch database"; docker exec "$C" psql -U roses -d postgres -c "drop database \"$SCRATCH\";"
  echo; echo "dumps in $DUMPDIR:"; ls -la "$DUMPDIR"/*.dump
} 2>&1 | tee "$OUT"
