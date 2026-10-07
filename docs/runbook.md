# Runbook (MVP, local)

Everything runs on one machine: Next.js and Postgres 16 in Docker (port 5433). Nothing here is deployed.

## Run locally (fresh clone)

Needs Git, Node 20 or newer with npm, and Docker Desktop running. Five commands from nothing to both venue pages and the admin:

```sh
git clone https://github.com/flo-kian-baban/Roses.git roses && cd roses
npm install
npm run setup
npm run start
npm run admin:create -- --email <your email> --name "<your name>"
```

- `npm run setup` writes `.env.local` with a random session secret, starts Postgres in Docker, applies the migrations, imports both venues from `data/raw` and makes the production build. It is safe to run again.
- `npm run start` serves http://localhost:3000/senso, http://localhost:3000/kebab-land and http://localhost:3000/admin.
- `npm run admin:create` asks for a password (10 characters or more) and creates the main admin account; sign in at `/admin` → "Main admin sign-in". Staff PINs are then created in Admin → PINs.
- Development with live reload: `npm run dev` instead of `npm run start` (pages are rendered on request there, not pre-built).

### On a phone on the same Wi-Fi

`npm run start` (and `npm run dev`) listen on every network interface and print a line `Network: http://<laptop-ip>:3000`. Open that address on the phone, for example `http://<laptop-ip>:3000/senso` or `/admin/senso`. If the line is missing, the laptop's address is in System Settings → Wi-Fi → Details, or from `ipconfig getifaddr en0` on macOS. macOS may ask once to allow incoming connections for Node. The lockout counts the phone's Wi-Fi address as its client address.

## Daily

- Public pages: http://localhost:3000/senso and /kebab-land. They are pre-rendered; an admin save regenerates the page within seconds (`res.revalidate`), no rebuild needed. A full `npm run build` is needed only after code changes.
- Admin: http://localhost:3000/admin. Staff and the owner sign in with a venue + 6-digit PIN; the main admins (owner, Kian) with email + password.

## Sign-in links

- Each venue has its own sign-in link to bookmark on staff phones: `/admin/senso` and `/admin/kebab-land`. The venue is preselected; the person types only the PIN. A wrong PIN counts against that venue and the phone's address, exactly as from the picker.
- `/admin` shows the venue picker (for people who work at both venues) and the main-admin sign-in link (`?mode=admin`).
- The old address `/admin/login` redirects to `/admin`.

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

## Go-live checklist

Done before anything goes public (nothing is public yet; hosting is Kian's decision). Each line needs a tick and the evidence noted next to it.

- [ ] Secure cookie flag on: the app is served over https, or `COOKIE_SECURE=1` is set; verify with `curl -sI -X POST <origin>/api/admin/login …` that `Set-Cookie` carries `Secure`.
- [ ] `TRUST_PROXY=1` is set only when the app sits behind a reverse proxy that overwrites `X-Forwarded-For` with the real client address; never when the app is reachable directly (otherwise a client could pick its own address and dodge the lockout).
- [ ] The "Drill Admin" account is deleted (`delete from admins where name = 'Drill Admin';`) and its password file removed from the build agent's scratch folder; the real admin accounts (owner, Kian) exist via `npm run admin:create`.
- [ ] Vector (SVG) logos for both venues received from the client and applied in `public/brand/` and the venue seed (`data/import/<date>/venues.json`, with source and sha256), replacing the copied PNGs.
- [ ] Venue details confirmed by the owner: names, addresses, phones (tap-to-call dials what is displayed), hours; the "to confirm" marks cleared in Admin → Venue details for every location.
- [ ] Kebab Land Persian reviewed: `reports/persian-review-kebab-land.csv` returned by Kian and applied with `node tools/import/persian-review-apply.mjs kebab-land <csv> [--accept-drafts] --reviewer "Kian"`; `persian-review-export.mjs kebab-land` then writes 0 rows.

## Check suite

`npm run check` runs every acceptance check in one go and writes `reports/checks/<date-time>/report.md` with the raw evidence next to it (screenshots, JSON, logs). It builds into `.next-check` so the running server and `.next` are untouched, starts two servers of its own on ports 3100 and 3101 (the second with `TRUST_PROXY=1` for the venue-cap test), creates a temporary admin account for the drills and deletes it at the end. Exit code 1 when any check fails. Run it before reporting a batch of changes done.

Checks: public page checks for both venues (intro, repeat visit, reduced motion, Persian toggle with rtl and headings, all images loaded), brand words, photo links, Lighthouse mobile ×3 per venue on the production build, the admin drill (PIN and admin sign-in, cookie, PINs, the listing rule in the UI, the API and the database, sections, notes permissions, three edits and a restore, delete and restore, venue details), the lockout drill (5 per venue and address, 50 per hour per venue with alert and unlock, revoked PIN), the revalidation drill (save reaches the public page within 10 s) and the backup and restore drill.

Needs once: `npx playwright install chromium`. Lighthouse uses Google Chrome when installed, otherwise that Chromium. Takes about 5 minutes. The drills change data only in ways they reverse themselves; the backup drill deletes one Kebab Land row by SQL and recovers it from the dump it just made (the dump stays in `backups/`).

## Evidence scripts

`scripts/check-page.mjs`, `check-lighthouse.mjs`, `check-brand-words.mjs`, `check-photo-links.mjs`, `lockout-drill.mjs`, `admin-drill.mjs`, `revalidation-drill.mjs`, `signin-links-check.mjs`, `backup-drill.sh` produce the files under `reports/`; `npm run check` runs them all.
