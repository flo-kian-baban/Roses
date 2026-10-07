#!/usr/bin/env bash
# T7 drill: backup, restore into a scratch database, compare per-table counts, delete an item on purpose,
# recover it from the restored copy, drop the scratch database. Output: reports/checkpoint-b/backup-drill.txt
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-reports/checkpoint-b/backup-drill.txt}"
C="roses-db"
Q() { docker exec "$C" psql -U roses -d "$1" -tAc "$2"; }
{
  echo "# Backup and restore drill — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo; echo "## 1. npm run db:backup"; npm run -s db:backup
  FILE=$(ls -t backups/*.dump | head -1); echo "newest dump: $FILE ($(wc -c < "$FILE" | tr -d ' ') bytes)"
  echo; echo "## 2. restore into the scratch database roses_restore_test"; bash scripts/db-restore.sh "$FILE" --into roses_restore_test
  echo; echo "## 3. per-table row counts, live vs restored"
  for t in venues sections items item_sections revisions admins pins login_failures admin_alerts schema_migrations; do L=$(Q roses "select count(*) from $t"); R=$(Q roses_restore_test "select count(*) from $t"); printf '%-18s live=%-6s restored=%-6s %s\n' "$t" "$L" "$R" "$([ "$L" = "$R" ] && echo equal || echo DIFFERENT)"; done
  echo; echo "## 4. delete an item on purpose (SQL, bypassing the admin) and recover it from the dump"
  ID=$(Q roses "select id from items where venue_id='kebab-land' and name->>'en'='Soft Drink'")
  echo "item: Soft Drink (kebab-land) id=$ID; placements before: $(Q roses "select count(*) from item_sections where item_id='$ID'")"
  docker exec "$C" psql -U roses -d roses -c "delete from items where id='$ID';"
  echo "after delete: items with that id = $(Q roses "select count(*) from items where id='$ID'"), placements = $(Q roses "select count(*) from item_sections where item_id='$ID'")"
  docker exec "$C" psql -U roses -d roses_restore_test -c "copy (select * from items where id='$ID') to stdout" | docker exec -i "$C" psql -U roses -d roses -c "copy items from stdin"
  docker exec "$C" psql -U roses -d roses_restore_test -c "copy (select * from item_sections where item_id='$ID') to stdout" | docker exec -i "$C" psql -U roses -d roses -c "copy item_sections from stdin"
  echo "after recovery: items with that id = $(Q roses "select count(*) from items where id='$ID'"), placements = $(Q roses "select count(*) from item_sections where item_id='$ID'"), name = $(Q roses "select name->>'en' from items where id='$ID'"), price = $(Q roses "select price from items where id='$ID'")"
  echo; echo "## 5. counts equal again?"
  for t in items item_sections; do L=$(Q roses "select count(*) from $t"); R=$(Q roses_restore_test "select count(*) from $t"); printf '%-18s live=%-6s restored=%-6s %s\n' "$t" "$L" "$R" "$([ "$L" = "$R" ] && echo equal || echo DIFFERENT)"; done
  echo; echo "## 6. drop the scratch database"; docker exec "$C" psql -U roses -d postgres -c "drop database roses_restore_test;"
  echo; echo "dumps on disk:"; ls -la backups/
} 2>&1 | tee "$OUT"
