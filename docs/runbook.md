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

- `npm run setup` writes `.env.local` with a random session secret, starts Postgres in Docker, applies the migrations, imports both venues from `data/raw`, applies the committed Persian review records (`data/import/<date>/<venue>/persian-review.json`, so Senso comes up with 0 draft flags) and makes the production build. It is safe to run again.
- `npm run start` serves http://localhost:3000/senso, http://localhost:3000/kebab-land and http://localhost:3000/admin.
- `npm run admin:create -- --email <email> --name "<name>" --pin <4 to 6 digits>` creates the main admin account; admins sign in with that PIN on any venue (no email typing). Add `--password` to also set an email + password sign-in. Staff PINs are then created in Admin → PINs.
- Development with live reload: `npm run dev` instead of `npm run start` (pages are rendered on request there, not pre-built).

### On a phone on the same Wi-Fi

`npm run start` (and `npm run dev`) listen on every network interface and print a line `Network: http://<laptop-ip>:3000`. Open that address on the phone, for example `http://<laptop-ip>:3000/senso` or `/admin/senso`. If the line is missing, the laptop's address is in System Settings → Wi-Fi → Details, or from `ipconfig getifaddr en0` on macOS. macOS may ask once to allow incoming connections for Node. The lockout counts the phone's Wi-Fi address as its client address.

## Daily

- Public pages: http://localhost:3000/senso and /kebab-land. They are pre-rendered; an admin save regenerates the page within seconds (`res.revalidate`), no rebuild needed. A full `npm run build` is needed only after code changes.
- Admin: http://localhost:3000/admin. Everyone signs in with a PIN on the venue's sign-in link (staff and owner PINs are venue-scoped; admin PINs work on any venue); email + password stays available for admin accounts that have one. Signed in, `/admin` goes straight to the first venue's page editor.

## Admin layout (page editor, Kian's rebuild of 2026-10-07)

- One top bar: the venue dropdown (switch venues), **Team** (PINs and admin accounts; owner and admin only) and the account menu (customers' page, sign out). Everything else is **one screen per venue: the page editor** at `/admin/<venue>`. There is no history page, no sections page and no counters.
- **Laptop**: the editor on the left, the customers' real page in a plain phone frame on the right (EN/FA toggle above it). **Phone**: the editor full screen and a **Preview** button that shows the customers' page full screen. The preview reloads after every save and scrolls to the item or section just edited, outlined for two seconds. The customers' page itself carries no preview code: the admin reaches into the frame after it loads.
- **Menu tab**: a *Needs attention* bar only when there is something to do (items needing a price, Persian drafts, missing Persian, items without a photo; tap one to filter), search as you type, *Jump to section*. Sections are collapsible groups; each header has the Shown/Hidden switch, the item count, **+ Add item** and a menu (Rename, Move up, Move down, Delete section). Item rows: photo · name with Persian underneath · price (tap it to change it in place) · Shown/Hidden switch. The switch refuses with a one-line reason when the item has no price (or a size has none). Badges only for exceptions: Hidden, Needs price, Persian draft, No photo. Reorder by dragging on a laptop; Move up / Move down in the item editor (and the section menu) on a phone.
- **+ Add item** on a section asks for name, price and an optional photo from the phone; the item is created shown when it has a price. Tapping a row opens the item editor (side panel on a laptop, full screen on a phone): *Basics* (name in both languages, price, photo, Shown/Hidden), *More* (description, sizes with **+ Add size**, *Also show in…*, order, serves) and *Advanced* (add-ons, combo parts, allergen/dietary/halal notes for owner and admin, delete). Every field saves itself when you leave it; there is no Save button.
- **Safety net**: after every change a **Saved · Undo** toast stays for 10 seconds; Undo puts the previous value back (also after a delete). Every change is still recorded in the `revisions` table with before/after snapshots, for disaster recovery only; no screen shows it (`select * from revisions where row_id = '<id>' order by id` on the laptop).
- Deleting a section that has items asks once what to do with them: **Move items to [section]** (the default; they go to the end of that section in their order) or **Delete the items too** (items also shown in another section stay there). Undo restores either outcome. Items that end up in no section are not a pile in the list: the *Needs attention* bar counts them ("N in no section"); tap the count to see them, open one and tick a section under *Also show in…*.
- **Photos** (step 2): *Add photo* / *Replace photo* in the item editor and in *+ Add item* opens the phone's camera or photos. The photo is shrunk on the phone (at most 1400 px, JPEG) and uploaded; linked photos from the import keep working and can be replaced or removed the same way. Uploads live on local disk (see *Uploads* below).
- **Tap-to-edit** (step 2): inside the preview, tap an item to open its editor, a section heading to rename it, or the header to open the Details tab. The customers' page itself has none of this: the admin attaches it to the frame after it loads.
- **Style** tab (rebuilt 2026-10-08; owner and admin, staff get 403 on its route): the page's colours, grouped by the parts customers see from top to bottom (Page, Header, Category tabs, Section headings, Item rows, Item popup, Footer, Intro; `src/venues/tokens.ts`), then a *Layout* group with the template's switches (logo animation, photos in the list; what the header shows on the default template; `src/venues/styles.ts`). Every colour has a plain label and a swatch; open a group, tap a colour, pick from the venue's own colours (the brand record), the phone's colour picker or a hex field. Text, hairlines and chips are *linked* to the background they sit on: "Auto" means they follow it (dark or light text for readability, dividers a light shade of it); a colour you set is "Custom" with *Back to auto*. The readability guard refuses a colour that would be hard to read (WCAG contrast 4.5:1 for text, 3:1 for headings and the tab underline) with the ratio, the threshold and a one-tap nearest colour that passes. The open group is outlined in the preview; tapping a part of the page in the preview opens its group. *Reset group to venue default* on each group and *Reset all colours* (with a confirmation) at the bottom; Undo works after both. Values are saved per venue (`venues.style.colors` plus the layout keys); the recorded brand colours are never changed and are the swatches.
- **Details** tab (step 2; owner and admin): name and tagline in both languages, the logo (upload from the phone; PNG or SVG with transparency looks best), locations (label, address, phone, hours; *To confirm* marks from the import clear when a field is edited or *Mark confirmed* is tapped; add and remove locations), and the switch *Show Persian drafts to customers*.
- **+ Add venue** (step 2; owner and admin), in the venue dropdown: a name creates the venue on the **default template** with one empty section and opens its Details tab. Its customers' page is `/<id>` (the id is made from the English name) and is rendered on its first request, then regenerated on every save like the others.
- Wording for staff: *Shown / Hidden* everywhere (the database column is still `listed`).

## Sign-in links

- Each venue has its own sign-in link to bookmark on staff phones: `/admin/senso` and `/admin/kebab-land`. The venue is preselected; the person types only the PIN. A wrong PIN counts against that venue and the phone's address, exactly as from the picker.
- `/admin` shows the venue picker (for people who work at both venues) and the main-admin sign-in link (`?mode=admin`). The old `/admin/pins` is now `/admin/team`.
- The old address `/admin/login` redirects to `/admin`.

## Admin accounts and PINs

- Create or reset an admin account: `npm run admin:create -- --email <email> --name "<name>" --pin <digits>` (4 to 6 digits), and/or `--password` (asks for the password; or set `ADMIN_PASSWORD` for the command). Add `--reset` to change the PIN or password of an existing account. Only scrypt hashes are stored. Admins sign in with their PIN on any venue's sign-in link; the email + password form is behind "Admin with email and password instead".
- PINs: in the admin, **Team** → Create (owner and admin). The PIN is shown once on the confirmation page; write it down for the person. Revoke it when the person leaves. Roles: *staff* edits menu content and listing; *owner* also edits allergen, dietary and halal notes, Team, Style, Details and + Add venue. Nobody's PIN is written down in the repo, in notes or in scripts; hand tests use a throwaway admin created in a scratch copy of the database.

## Lockout

- 5 wrong PINs from one address lock that venue for that address for 15 minutes (the sign-in page says until when).
- 50 wrong PINs within an hour on one venue lock PIN sign-in for that venue and raise an alert on the admin home. An admin clears it with **Unlock PIN login** on the alert (or waits an hour).
- Behind a reverse proxy set `TRUST_PROXY=1` so the client address is read from `X-Forwarded-For`; never set it when the app is reached directly.

## Uploads

Photos and logos uploaded in the admin are stored on local disk behind one small interface (`src/lib/storage.ts`): `uploads/<venue>/<kind>-<uuid>.<ext>` (gitignored; `UPLOAD_DIR` moves the folder), served at `/uploads/<key>` by an API route with a one-year cache. The database row keeps the address, the storage key and the pixel size. Supabase Storage comes later behind the same interface (`STORAGE_DRIVER`). A replaced or removed photo's file stays on disk (Undo may need it) until `npm run uploads:clean` runs: it removes every file no item or venue row references and prints each one (`-- --dry-run` only prints; files younger than 60 minutes are kept, an upload whose item is still being added has no row yet). **Back up `uploads/` together with the database dump**: a dump alone does not contain the photos.

## Backups

- `npm run db:backup` → `backups/roses-<UTC timestamp>.dump` (custom format, from the `pg_dump` inside the container). `backups/` is gitignored. Copy the file somewhere else as well (another disk or a private cloud folder), and copy the `uploads/` folder with it.
- Restore into a scratch database to inspect or recover a row: `npm run db:restore -- backups/<file> --into roses_restore_test`; the script prints per-table row counts. Recover one item with `copy … to stdout | copy … from stdin` between the two databases (the exact commands are in `scripts/backup-drill.sh`). Drop the scratch database afterwards: `docker exec roses-db psql -U roses -d postgres -c 'drop database roses_restore_test;'`.
- Replace the live database (last resort): `npm run db:restore -- backups/<file> --replace`, type `REPLACE`, then `npm run build` so the public pages match the data.
- Item-level undo does not need a backup: every change shows **Saved · Undo** for 10 seconds, and every change stays in the `revisions` table (before/after snapshots) for recovery by hand.

## Re-import

`npm run import -- senso --load` and `npm run import -- kebab-land --load` rebuild the import files from `data/raw/` and upsert rows that no person has edited yet (rows with `updated_by.kind = 'import'`). Edited rows are left alone. The import is for the first load of a venue only.

## Moving to hosted Postgres (later, on Kian's decision)

The hosted database is filled from the working database by dump and restore (`npm run db:backup`, then `pg_restore` into the hosted database, then equal per-table counts checked), never by re-import. Admin edits, Persian reviews and PINs made during Milestone 1 carry over unchanged.

## Go-live checklist

Done before anything goes public (nothing is public yet; hosting is Kian's decision). Each line needs a tick and the evidence noted next to it.

- [ ] Secure cookie flag on: the app is served over https, or `COOKIE_SECURE=1` is set; verify with `curl -sI -X POST <origin>/api/admin/login …` that `Set-Cookie` carries `Secure`.
- [ ] `TRUST_PROXY=1` is set only when the app sits behind a reverse proxy that overwrites `X-Forwarded-For` with the real client address; never when the app is reachable directly (otherwise a client could pick its own address and dodge the lockout).
- [ ] Kian's temporary admin PIN replaced by a 6-digit one (`npm run admin:create -- --email <email> --name "Kian" --pin <new digits> --reset`); every admin and owner PIN is 6 digits.
- [ ] The "Drill Admin" account is deleted (`delete from admins where name = 'Drill Admin';`) and its password file removed from the build agent's scratch folder; the real admin accounts (owner, Kian) exist via `npm run admin:create`.
- [ ] Vector (SVG) logos for both venues received from the client and applied in `public/brand/` and the venue seed (`data/import/<date>/venues.json`, with source and sha256), replacing the copied PNGs.
- [ ] Venue details confirmed by the owner: names, addresses, phones (tap-to-call dials what is displayed), hours; the "to confirm" marks cleared in Admin → Venue details for every location.
- [ ] Kebab Land Persian reviewed: `reports/persian-review-kebab-land.csv` returned by Kian and applied with `node tools/import/persian-review-apply.mjs kebab-land <csv> [--accept-drafts] --reviewer "Kian"`; `persian-review-export.mjs kebab-land` then writes 0 rows.
- [ ] `npm run uploads:clean` run once (after a `--dry-run` read), so only referenced photos and logos move to the hosted storage.
- [ ] Uploads moved at the hosting move: the `uploads/` folder copied into Supabase Storage, the storage driver switched (`STORAGE_DRIVER`), then every photo and logo URL in the database (`items.photo->>'url'`, `venues.brand->'logo'->>'url'`) requested from the new storage with `scripts/check-photo-links.mjs` for each venue: zero failures, and zero files left on the local disk.
- [ ] Until that move, every backup includes the `uploads/` folder next to the dump (see *Backups*).
- [ ] No history rewrite for the old PIN mention (PM, 2026-10-08): the documents no longer carry it; changing Kian's admin PIN before hosting stays on this list (above).

## Check suite

`npm run check` runs every acceptance check in one go and writes `reports/checks/<date-time>/report.md` with the raw evidence next to it (screenshots, JSON, logs). It runs on committed code only (PM, 2026-10-08): with uncommitted changes outside `reports/checks` in the working tree it prints `git status --short` and exits 2, so every report names the exact commit it tested. Flow: commit the code, run the suite, commit the report. A second session in this repo works in its own git worktree and branch (`git worktree add ../roses-<topic> -b <topic>`) and merges into `main` by rebase once its batch passes. It never touches the working database: it copies it with `pg_dump` into a scratch database, applies pending migrations to the copy, points the build, both servers, every drill and their uploads at the copy (uploads land in the run folder), and drops the copy at the end. Isolation is proven, not counted (PM, 2026-10-08), so Kian can use the app during a run: **(a)** every server and drill process names itself to Postgres (`application_name roses-check:…`) and logs the database it connected to, and `pg_stat_activity` is sampled every 400 ms through the run; any suite process seen on the working database fails the run (`isolation.json`); **(b)** at the end the working database is searched for rows written by suite accounts (the temporary check admin, the drill PINs, drill items, sections or venues, lockout-drill failure rows): any such row fails the run (`working-db-suite-rows.json`). It builds into `.next-check` so the running server and `.next` are untouched, starts two servers of its own on ports 3100 and 3101 (the second with `TRUST_PROXY=1` for the venue-cap test), and creates a temporary admin account in the copy. Exit code 1 when any check fails. **A failed run is never deleted**: its folder stays in the repo and its report carries a one-line `Cause:` (written by the suite from the first failing check; refine it by hand), even when a re-run passes. Run it before reporting a batch of changes done.

Checks: migrations on the scratch copy, production build, the colour-literal scan of the public templates, the menu kit and the public stylesheet (0 outside `src/venues/tokens.ts`), a temporary venue on the default template created through the admin API in the scratch copy (logo upload, tagline, location, two sections, four items; removed at the end) and checked like the two brand pages (page checks, Lighthouse mobile ×3 with LCP ≤ 2.5 s, brand words, no runtime JavaScript), public page checks for both venues (intro on the first visit with the page sliding in behind it, again on a reload with nothing stored, reduced motion with the page visible at once, Persian toggle with rtl and headings, all images loaded), brand words, photo links (uploaded ones fetched from the suite's own server), Lighthouse mobile ×3 per venue on the production build, the admin drill (PIN and admin sign-in, cookie, Team PINs, the listing rule in the UI, the API and the database, sections, notes permissions, the Style route 403 for staff, the owner changing a colour and a switch in the Style tab and the tagline in the Details tab with each reaching the public page and undone, + Add venue with its tap count and the new page answering, revoked PIN), the lockout drill (5 per venue and address, 50 per hour per venue with alert and unlock, revoked PIN), the revalidation drill (a price changed in place reaches the public page within 10 s, then Undo), the Style tab drill (the served colour variables equal the pre-token look of 2026-10-07 apart from the six pure-black places now using the kit's ink; change the category bar background on an iPhone viewport with its tap count; the preview shows a saved colour within 1 s with "Saved · Undo", the public page carries it, Undo restores it; a dark row background re-derives the Auto text colours while a Custom one stays, Reset group then Undo; the readability guard in the tab and on the route with the known pairs: Senso gold on cream refused at about 2.5:1 with the one-tap fix, navy on cream allowed at about 12:1, Kebab Land red on #141414 refused for a price at about 3.1:1 and allowed for a section title; a tap on a region in the preview opens its group and an open group outlines its region; Reset all colours with its confirmation then Undo; the Persian view keeps the colours), the page editor drill (task targets on an iPhone viewport with the tap count: add an item, change a price, hide an item, upload a photo; the preview shows a saved change within 1 s; a reorder appears in the same order on the public page; Undo restores a price and a deleted item on the public page; tap-to-edit in the preview; drag-and-drop of an item and of a section on a laptop with admin order = database = public page; deleting a section with "Move items to" and with "Delete the items too", each undone; items in no section counted in the Needs-attention bar; the change record has before/after rows and no screen shows it; the customers' HTML has no preview script; the preview never shows the logo intro), the backup and restore drill, `uploads:clean` on the run's own uploads (the temporary venue's logo kept, the editor drill's orphan photo removed), the temporary venue's removal, and the two isolation checks.

Needs once: `npx playwright install chromium`. Lighthouse uses Google Chrome when installed, otherwise that Chromium. Takes about three minutes. Screenshots, full Lighthouse JSON and dumps stay on disk only (gitignored); the report and the small JSON and text evidence are committed.

## Evidence scripts

`scripts/check-page.mjs`, `check-lighthouse.mjs`, `check-brand-words.mjs`, `check-colour-literals.mjs`, `check-photo-links.mjs`, `lockout-drill.mjs`, `admin-drill.mjs`, `editor-drill.mjs`, `style-drill.mjs`, `revalidation-drill.mjs`, `signin-links-check.mjs`, `backup-drill.sh` produce the files under `reports/`; `npm run check` runs them all. `scripts/style-identity.mjs` (`shoot` a server's pages, `compare` two sets pixel by pixel on a canvas, no dependency) made the one-off day-one evidence of the colour tokens in `reports/style-tokens/`.
