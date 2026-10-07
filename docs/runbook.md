# Runbook (MVP, local)

Everything runs on one machine: Next.js (`npm run build && npm run start`) and Postgres 16 in Docker (`npm run db:up`, port 5433). `.env.local` holds `DATABASE_URL` and `SESSION_SECRET` (copy `.env.example`; generate the secret with the command in that file). Nothing here is deployed.

## Daily

- Public pages: http://localhost:3000/senso and /kebab-land. They are pre-rendered; an admin save regenerates the page within seconds (`res.revalidate`), no rebuild needed. A full `npm run build` is needed only after code changes.
- Admin: http://localhost:3000/admin. Staff and the owner sign in with a venue + 6-digit PIN; the main admins (owner, Kian) with email + password.

## Admin accounts and PINs

- Create or reset an admin account: `npm run admin:create -- --email <email> --name "<name>"` (asks for the password; or set `ADMIN_PASSWORD` for the command). Add `--reset` to change the password of an existing account. Only a scrypt hash is stored.
- PINs: in the admin, **PINs** → Create. The PIN is shown once on the confirmation page; write it down for the person. Revoke it when the person leaves. Roles: *staff* edits menu content and listing; *owner* also edits allergen, dietary and halal notes. Venue details (name, phones, addresses, hours) are edited by the main admins only.

## Lockout

- 5 wrong PINs from one address lock that venue for that address for 15 minutes (the sign-in page says until when).
- 50 wrong PINs within an hour on one venue lock PIN sign-in for that venue and raise an alert on the admin home. An admin clears it with **Unlock PIN login** on the alert (or waits an hour).
- Behind a reverse proxy set `TRUST_PROXY=1` so the client address is read from `X-Forwarded-For`; never set it when the app is reached directly.

## Backups

- `npm run db:backup` → `backups/roses-<UTC timestamp>.dump` (custom format, from the `pg_dump` inside the container). `backups/` is gitignored. Copy the file somewhere else as well (another disk or a private cloud folder).
- Restore into a scratch database to inspect or recover a row: `npm run db:restore -- backups/<file> --into roses_restore_test`; the script prints per-table row counts. Recover one item with `copy … to stdout | copy … from stdin` between the two databases (the exact commands are in `scripts/backup-drill.sh`). Drop the scratch database afterwards: `docker exec roses-db psql -U roses -d postgres -c 'drop database roses_restore_test;'`.
- Replace the live database (last resort): `npm run db:restore -- backups/<file> --replace`, type `REPLACE`, then `npm run build` so the public pages match the data.
- Item-level undo does not need a backup: every edit is in the admin's History with a Restore button.

## Re-import

`npm run import -- senso --load` and `npm run import -- kebab-land --load` rebuild the import files from `data/raw/` and upsert rows that no person has edited yet (rows with `updated_by.kind = 'import'`). Edited rows are left alone.

## Evidence scripts

`scripts/check-page.mjs`, `check-lighthouse.mjs`, `check-brand-words.mjs`, `check-photo-links.mjs`, `lockout-drill.mjs`, `admin-drill.mjs`, `revalidation-drill.mjs`, `backup-drill.sh` produce the files under `reports/`.
