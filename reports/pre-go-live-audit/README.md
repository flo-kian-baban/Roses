# Pre-go-live audit, Part A: code audit

The PM's brief of 2026-11-02, Part A, on 046a2ba (the version the owner confirmed). Part B (UI/UX, report only) is in [reports/ui-audit/](../ui-audit/README.md); Part C is [docs/real-phone-test.md](../../docs/real-phone-test.md).

## How it was run

- **Independent reviewers.** Four fresh agents that had not seen this build, each given only the repo, CLAUDE.md and the brief, split by the brief's items: authorization, sessions and PINs, secrets and dependencies (items 1, 4, 5, 6: "S1"); input validation and XSS (2, 3: "S2"); data integrity and correctness (7, 8: "D"); code health (9: "H"). They reported only; this session verified and fixed.
- **Scratch copies only.** Each reviewer had its own `pg_dump` copy of the working database and its own production server of 046a2ba on 127.0.0.1 with throwaway accounts (an admin, a Senso owner PIN, staff PINs for each venue). Nobody used the working database, port 3000 or anyone's real PIN; the scratch databases are dropped after the audit.
- **Fixes.** Every Critical or High correctness or security finding that code can fix was fixed on branch `audit`, one commit per finding, each with one test in an existing drill (no new test infrastructure). Each test was run against the fix (pass) and, where the drill could reach it, against the unfixed build (fail). The reviewers' own reproduction scripts were run again against the fixed build.

## Totals

After merging duplicates between reviewers: **no Critical**; **12 High** (9 fixed, 3 need Kian); **34 Medium** and **30 Low** in the list below (including four residuals the fixes leave open; H-17 groups several dead-code items). TypeScript: 0 errors under `strict`, no `any` (before and after). `npm audit --omit=dev`: 1 critical package (next) and 1 high (zod) before, **0** after. **No XSS** anywhere (16 payload classes through every admin field, all three templates, both languages, Chromium and WebKit: 0 dialogs, 0 page errors).

## High findings fixed

| ID (and duplicates) | Finding | Commit | Test (drill · check id) | Re-verified |
|---|---|---|---|---|
| S1-07 | Next.js 16.4.0 carried GHSA-2464-fhr4-w9xw and GHSA-673q-mjm6-r5xr (critical, remote code execution; not reachable here) and GHSA-p3m5-59mp-jv5r (high, denial of service through the admin pages); `"next": "latest"` in package.json. Now 16.4.3, pinned exactly. | fba8f4c | suite step `dependency-advisories` | `npm audit --omit=dev`: 0; the build no longer stops on Next's security banner |
| S1-15 (counted with S1-07) | zod, never imported, carried a high advisory: removed. | a59ee33 | same step: zod not a production dependency | `npm audit --omit=dev`: 0 |
| S1-01 (= S2-X1, S2-X2) | An owner PIN for one venue could create an owner PIN for any other venue (and sign in there with owner rights), revoke any venue's PINs, and see every PIN and the admin accounts' emails in Team. Now an owner creates, sees and revokes only PINs whose venues are all theirs; the admin accounts are shown to admins only. | 4738c68 | admin drill · `owner-pin-scope` | reviewer's t11: mint 403, Team lists only Senso PINs, 0 admin emails |
| S1-02 (= S2-X3, D-22, H-02; closes D-04) | Undo bypassed the role rules: staff could take back the owner's allergen notes, a Confirm or a section's layout by sending its change record, at any age; and undoing one's own older edit put the whole row back over someone else's later change. Now Undo accepts only one's own records (403) and refuses a record whose row someone else changed since (409). | 2926a6b | admin drill · `undo-own-only` | reviewer's t03 and D's t4: every staff undo of the owner's records 403; own older edit after the owner's change 409, the owner's notes intact |
| S1-03 (= H-01) | A session could not be ended: a revoked PIN's open session kept editing for up to 12 hours (and a revoked owner could mint a new PIN with it); an admin whose PIN or password was reset, or whose account was deleted, kept admin rights. Now every admin route and page reads the person from the database on each request (a revoked PIN or a missing admin has no session; an admin's token carries a fingerprint of their credentials, so a reset ends older sessions). | 7a56b30 | admin drill · `revoked-session` | reviewer's t04: revoked PIN 401, admin reset 401, admin deleted 401 |
| S1-04 | The lockout did not hold under concurrent attempts: 40 wrong PINs sent together were all checked, and the right PIN sent last signed in (limit 5). Now each attempt is counted before its PIN is checked; a successful sign-in takes its own attempt back off the counts. Sequential behaviour unchanged. | 92c5f43 | lockout drill · the burst (20 at once) | reviewer's t05: 5 checked, 35 refused, the right PIN refused |
| D-01 | Several saves failed with nothing the person could see (section switch, Move up/down, drag and drop, Style and Details errors off-screen on a phone, Reset all / Discard stuck). Now every failed save turns the toast red, in view, with "Try again" when a retry can help. | af30f19 | editor drill · `t-fail-visible` | D's t3: section switch and move, no connection and server error: "Not saved … Try again" |
| D-02 (= H-14 for fields) | A failed save threw away what was typed, with no retry. Now text and price fields keep what was typed, marked "Not saved", until it is saved; Try again re-sends it. | af30f19 | editor drill · `t-fail-keeps-text` | D's t1: name and description kept in the field with Try again; sizes, choices and the in-place price offer Try again |
| D-03 | An editor opened earlier silently overwrote other people's changes (whole bilingual names, whole size and choice lists, the tagline's other language). Now item saves carry the item's version and a save over a newer change is refused (409) with the latest version put on screen; the Details tab sends only the language edited. | 120e55a | editor drill · `t-stale-refused` | D's sizes case: 409, the added size kept; tagline: both languages kept |
| D-10 (= S2-05) | A section's name became an element id shared with the page's own: a section named "Welcome" covered the welcome screen, one named "Sheet" stopped every item popup. Now section anchors are "s-" and the slug, numbered when repeated. | b94a7c7 | editor drill · `t-section-ids` | D's t18: the real English button on top; one #welcome, one #sheet |

Every new test passes on the fixed build (admin drill run on a scratch copy; editor drill 38/38) and fails on 046a2ba where the drill reaches it (editor drill 34/38: exactly the four new checks; admin drill: `owner-pin-scope`, whose successful escalation then revokes the drill's owner PIN, so later steps cannot run there; lockout burst shown by the reviewer's t05 on the old build).

## High findings that need Kian (not fixed in code)

1. **S1-05: admin PINs can be guessed across venues.** Every admin PIN is tried on every venue's sign-in and the 50-per-hour cap is per venue: about 100 guesses an hour against admin PINs (a 4-digit admin PIN falls in about 50 hours on average). A staff member can also reset their own address's count by signing in correctly between guesses. The fix changes rulings (admin PINs "4 to 6 digits"; the cap per venue): enforce 6 or more digits for admin PINs, and/or count admin-PIN failures across venues. The go-live checklist already asks for 6-digit admin PINs.
2. **S1-06: a real admin PIN is in git history** (Kian's temporary PIN, commit 6629ece, removed in 2581304; reachable from origin/main). The PM ruled out rewriting history; the PIN must be changed before anything is reachable from outside (go-live checklist). Not tested whether it still works (nobody may use another person's PIN).
3. **S1-24 (= H-03, D-13): photo and logo uploads cannot work on Vercel as built.** The only storage driver writes to local disk; Vercel's disk is read-only apart from a temporary folder per instance, and `STORAGE_DRIVER` has no other value to switch to. CLAUDE.md also contradicts itself (the PM's build decision excludes Supabase Storage while the go-live list plans it). A storage decision is needed before the hosting move (an S3-compatible driver covers Supabase, R2 and S3).

## Medium and Low findings (for Kian; not fixed)

Merged across reviewers (the IDs in brackets are the same finding seen by another reviewer). "Residual" rows are what a High fix above leaves open.

| ID | Sev. | Finding | Where | Proposed fix |
|---|---|---|---|---|
| S1-08 [S2-08] | Medium | Forged cross-site requests are stopped only by the cookie's SameSite=Lax: no Origin check, and the JSON routes accept form-encoded bodies (a form `action=delete&id=…` deleted an item). A page on the same site (e.g. a sibling subdomain next to a venue's WordPress) could act as the signed-in person. | `src/lib/admin/api.ts` | Refuse POSTs whose Origin / Sec-Fetch-Site is not the app's; require `application/json` on JSON routes; `frame-ancestors 'self'` on /admin |
| S1-09 | Medium | The client address: with `TRUST_PROXY=1` the first X-Forwarded-For entry is used (spoofable behind proxies that append, so the per-address lockout disappears); without it behind Vercel every client shares one address (5 typos by anyone lock a venue's staff for 15 minutes); IPv6 counted per address; email + password sign-in has no overall cap. | `src/lib/admin/lockout.ts` | Read the address a configured number of hops from the right (or Vercel's own header); document `TRUST_PROXY=1` as required on Vercel; count IPv6 per /64; an overall cap with an alert on password failures |
| residual of S1-03 | Medium | A session token copied before sign-out stays valid until its 12 hours end (sign-out clears it on the device). | `src/lib/admin/auth.ts` | A "sessions valid after" time per person (a new column: a data-model change for Kian) |
| S1-10 [H-07] | Medium | `PREVIEW_BUILD=1` hides only the admin pages; the whole admin API keeps working. | `src/app/admin/layout.tsx` | Enforce it in the route helpers and the upload route, or remove the flag |
| S1-11 [S2-17, D-23] | Medium | An owner who uses "+ Add venue" creates a public venue they cannot open (403), with no Undo and no delete. | `src/pages/api/admin/venue.ts` | Add the venue to the owner's PIN, or make "+ Add venue" admin-only (Kian) |
| S1-12 | Medium | Node 20 has been out of support since 2026-04-30; nothing pins the Node version for the host. | `package.json` | Node 22 or 24, `"engines"` |
| S1-13 [H-10] | Medium | react, react-dom, @types/react and @types/react-dom still float on `latest` (next is pinned now); chrome-launcher is used but not declared. | `package.json` | Pin exact versions; declare chrome-launcher |
| S1-14 | Medium | Anyone can lock a venue's PIN sign-in for an hour with 50 wrong PINs, every hour (Kian's ruled cap). | `src/lib/admin/lockout.ts` | Kian: a cap per address or block, the venue cap as an alert only, or email + password while capped |
| S2-01 [H-08] | Medium | Combo-part rows keep every key sent; a staff request with a deeply nested value takes `/admin/<venue>` down for every role (the public page is fine); `item_id` accepts another venue's item. | `src/pages/api/admin/item.ts` | Keep only `{item_id (same venue), label, qty 1–99}` |
| S2-02 | Medium | No length or count limits on any text, size, choice, part or location (a 480 KB description made Senso's page 1.7 MB; change records grow with every save). | `src/lib/admin/api.ts` | Server caps per field with matching `maxLength` (numbers for Kian) |
| S2-03 | Medium | Invisible direction marks (U+202A–E, U+2066–9, e.g. pasted from Word) are stored and garble the row's price line ("SmallLarge $19 · $12.50"); the popup stays right. | `src/components/menu-kit.tsx` | Strip those marks on save; isolate size labels and amounts in the row |
| S2-04 | Medium | A photo address accepts other hosts (`//host`, `/\host`, any https) through the API; the logo accepts any https address. | `src/lib/admin/api.ts`, `venue.ts` | New values: our own `/uploads/` keys or the three known source hosts only |
| S2-06 | Medium | Malformed values are silently coerced, some destructively: `section_ids:"x"` removes an item from every section, `locations:{}` deletes all locations, `logo:"x"` removes the logo (API only). | `src/lib/admin/api.ts` and the routes | A strict reader per field, 400 with a reason |
| S2-09 | Medium | Uploads check only the first bytes (an image signature followed by HTML is stored), trust pixel sizes in the file, and have no quota (files are served inert). | `src/pages/api/admin/upload.ts` | Validate the structure and sizes; a quota and rate limit |
| S2-10 [S1-22] | Medium | No Content-Security-Policy, frame protection, HSTS or Referrer-Policy on the public pages or the admin. | `next.config.ts` | Admin: CSP and `frame-ancestors 'none'`; public: a CSP with hashes of the constant inline scripts |
| H-04 [D-18] | Medium | The price rule exists three times and the database check is weaker (a shown item with one unpriced size passes by SQL). | `items.ts`, `state.ts`, `001_init.sql` | One function; a stricter check in a new migration |
| H-05 | Medium | Any other cookie on the domain with a stray `%` makes every admin API call answer 500, sign-in included. | `src/lib/admin/auth.ts` | Decode only `roses_session`, inside try |
| H-06 [S1-20, S2-13] | Medium | Server faults answer 400 with raw database text; 5xx never fires; database messages reach the staff toast. | `src/lib/admin/api.ts` | Unknown errors → logged, 500, a plain message |
| H-09 | Medium | No linter or typecheck script; 18 `eslint-disable` comments for a rule nothing runs; 4 unused-variable hits. | `package.json` | A `typecheck` script in the suite; remove the stale comments |
| H-11 | Medium | Generated browser code kept in step by string replacement (an edit can break every public page at build); the language switch written three times. | `src/components/Welcome.tsx`, `LangToggle.tsx` | One template per script |
| H-12 | Medium | 14 hand-written transactions with 42 manual rollbacks and no helper (all correct today). | `src/lib/admin/*.ts` | A `withTx` helper |
| H-13 [D-12] | Medium | When the public page fails to regenerate after a save, the admin still says "Saved"; customers keep the old menu up to an hour. | `src/lib/admin/api.ts` and every route | Return the result; "Customers' page not updated · Try again" |
| H-14 (rest) | Medium | An invalid price in a size or choice row (e.g. `1,50`) is dropped silently. | `Choices.tsx` | Mark the row; accept a decimal comma |
| H-15 | Medium | A Persian draft flag on sizes, choices or parts is cleared when only a price or quantity changes (no effect today: both venues show drafts). | `src/lib/admin/items.ts` | Compare only the Persian parts |
| D-05 | Medium | A save whose answer was lost shows as failed while it went through; trying "+ Add item" again creates a duplicate item. | `api.ts`, `items.ts` | A client key per create; re-read before reverting |
| D-06 | Medium | No time limit and no "saving…" state: a save that never answers looks saved; later edits of that item wait behind it and are lost if the page closes. | `api.ts`, `Editor.tsx` | A ~15 s limit into the same failure toast; warn before leaving with saves pending |
| D-07 | Medium | Back or a reload while a field is being typed loses it (fields save on leaving them). | `ui.tsx` | Save while typing after a short pause, or when the page is hidden |
| D-08 | Medium | Clearing a size's price (to retype it) deletes the size at once, with "Saved · Undo". | `Choices.tsx` | Hold the save, or "A size needs a price" |
| D-09 | Medium | A second tap on "+ Add item" can land on the toast's Undo (3 of 7 runs). | `Editor.tsx` | Ignore Undo taps for ~600 ms after the toast appears |
| D-11 | Medium | A fresh setup gives both venues the default template (the live data has their own); CLAUDE.md says a fresh clone reproduces the reviewed state. | `004_template_style.sql`, `tools/import/load.mjs` | Carry the template in the venue seed |
| D-14 | Medium (suspected) | On several instances without a shared page cache, or behind a caching CDN, a save may not reach every customer within 10 s. | hosting | One instance and no caching CDN, or a shared cache and a purge on save |
| D-15 [H-27] | Medium | Style saves arriving together overwrite each other (6 at once, 1 kept); the Details tab writes whole locations from its own copy. | `style.ts`, `venue.ts` | Merge inside one locked transaction; per-field patches |
| residual of D-02 | Medium | In the size and choice rows and the in-place price, the screen shows the saved value while Try again holds the typed one (the text fields keep it on screen). | `Choices.tsx`, `MenuTab.tsx` | Keep the typed rows on screen until saved |
| residual of D-03 | Medium | Sections (rename) and the venue's locations still save without a version check. | `sections.ts`, `venue.ts` | The same version check (sections' reorders must then return their versions) |
| residual of S1-02 | Low | A person can still undo their own change through the API after the toast's 10 s, as long as nobody changed the row since. | `undo.ts` | An age limit (e.g. 1 hour) |
| S1-16 | Low | Response time reveals which admin emails exist (42 ms vs 8 ms). | `pins.ts` | Always check against a dummy hash |
| S1-17 | Low | The venues' public business phone numbers are in committed import files and evidence (the content rule says no phone numbers). | `data/import/…`, reports | PM: count them as venue content, or remove (history rewrite) |
| S1-18 | Low | Lock messages show the time in the server's time zone (UTC on Vercel: 4–5 hours off for Toronto). | `login.ts` | `timeZone: 'America/Toronto'` |
| S1-19 [H-26] | Low | Go-live documents: the checklist's `curl` cannot show `Secure` (use `/api/admin/logout`); `TRUST_PROXY` must be 1 on Vercel; a fresh production `SESSION_SECRET`; database TLS and pooling; `.env.example` lacks UPLOAD_DIR, STORAGE_DRIVER, ROSES_APP_NAME and the two never-set variables; non-numeric LOCKOUT_* values. | `docs/runbook.md`, `.env.example` | Update both |
| S1-21 | Low | PIN creation: an admin can name a venue that does not exist; a new PIN can equal another active one; owner-made PINs record no creator. | `pin.ts`, `pins.ts` | Validate; regenerate on a clash |
| S1-23 [H-20] | Low | The synchronous PIN and password hashing blocks the server ~50 ms per active PIN on each attempt. | `auth.ts` | Async scrypt |
| S2-07 [H-25] | Low | Price quirks: `" "`, `"\t"`, `"$"` save as $0.00 (API); `0x10`, `1e3` accepted; `0.001` → $0.00. | `api.ts`, `ui.tsx` | One pattern `^\$?\d{1,6}(\.\d{1,2})?$` both sides |
| S2-11 | Low | Style restore keeps unknown keys of any size. | `style.ts` | Keep only the named legacy keys |
| S2-12 | Low | Lookups by user key on plain objects (`__proto__`, `toString` pass as no-ops). | `item.ts`, `transitions.ts` | `Object.hasOwn` |
| S2-14 | Low | Control characters stored and published; a zero-width-only name passes "required". | `api.ts` | Strip controls; treat invisible names as empty |
| S2-15 | Low | A phone with no digits gives a dead `tel:` link; Persian digits refused instead of converted. | `venue.ts` | 7–15 digits; convert Persian digits |
| S2-16 | Low | The logo's size is taken from the client (`1e308`, `0.4`). | `venue.ts` | Integers 1–10000 |
| S2-17 | Low | "+ Add venue" accepts names whose address cannot be served ("404"). | `src/lib/admin/venue.ts` | Reserve them |
| S2-18 | Low | Any `?error=` text is shown in the sign-in alert. | `src/app/admin/_ui/index.tsx` | Fixed messages by code |
| S2-19 | Low | The review CSV export does not neutralise spreadsheet formulas. | `tools/import/research-review-lib.mjs` | Prefix `'` on export |
| S2-20 | Low | A photo's storage key comes from the client and is not tied to its address; `uploads:clean` trusts it. | `api.ts`, `uploads-clean.mjs` | Derive the key from the address |
| S2-21 | Low | A PIN typed with Persian digits counts as a wrong PIN. | `login.ts` | Convert Persian digits |
| D-16 | Low | The first visitor after a quiet night on the 1st can get the previous season's page once. | `src/lib/welcome.ts` | Acceptable, or regenerate at 00:00 Toronto on season days |
| D-17 | Low | A very long unbroken word widens the public page on a phone (769 px instead of 390). | `menu-kit.tsx` | `overflow-wrap: anywhere` |
| D-20 | Low | An admin page left open across the 1st keeps the old season (labels, the Seasonal tag). | `[venue]/page.tsx` | Tag on the server; recompute on focus |
| D-21 | Low | `npm run setup` on a fresh clone rewrites committed import files, so `npm run check` refuses to start until reverted. | `tools/import/run.mjs` | Build into a temporary folder |
| H-16 | Low | Three mechanisms decide a venue's template (route files, ids in the preview API, `venue.template`). | `welcome-scene.ts`, `styles.ts` | Dispatch by `venue.template` |
| H-17 | Low | Dead code: 7 unused functions or constants, 9 unused icons (one of the removed History page), two fonts loaded on every public page but never used, a database view, `scripts/font-comparison.mjs`. | see the code-health list | Delete |
| H-18 | Low | Duplicated helpers that can drift (season lists ×8, price formatting ×2, slug regex ×6, lockout default ×2). | various | Consolidate |
| H-19 | Low | Types say more than runtime (`Item.price` arrives as a string; the session claims cast unchecked). | `types.ts`, `auth.ts` | Type guards |
| H-21 | Low | Stale comments ("no client JavaScript" in the admin CSS, "the intro is skipped", "Fall specials"). | `globals.css`, `style-identity.mjs`, `006_seasonal.sql` | Edit |
| H-22 | Low | 316 MB tracked in `reports/` and `data/` (105 suite runs). | repo | Keep one run per milestone |
| H-23 | Low | A few very large components (`Editor` 26 KB in one function; `welcome-transitions.ts` 51 KB of code in strings). | `_editor/`, `src/lib` | Split |
| H-24 | Low | `scripts/` and `tools/` are untyped by design (253 diagnostics under `checkJs`). | `scripts/`, `tools/` | Leave |

Also reported and fixed as side effects: D-19 (after a failed save the toast offered Undo of the change before it: fixed with D-01/D-02).

## Routes and the role each requires, as tested

Tested with real requests as: no session, Senso staff, Kebab Land staff, the Senso owner, and an admin (by PIN and by email + password). "S:" / "K:" = acting on a Senso / Kebab Land object. Rows marked *fixed* answered wrongly on 046a2ba.

| Route | Method / action | Required | none | staff S | staff K | owner S | admin |
|---|---|---|---|---|---|---|---|
| /api/admin/login | POST (PIN or email) | anonymous | 303 | | | | |
| /api/admin/logout | POST | anonymous | 303, cookie cleared | | | | |
| /api/admin/item | create, update, looks-good, duplicate, move, copy-choices, delete | edit the venue | 401 | S:200 K:403 | S:403 K:200 | S:200 K:403 | 200 |
| | notes, confirm | owner or admin | 401 | 403 | 403 | S:200 K:403 | 200 |
| | another venue's section, move target or copy target in the request | refused | | 400, nothing written | | | |
| /api/admin/section | create, reorder, rename, show/hide, move, delete | edit the venue | 401 | S:200 K:403 | S:403 K:200 | S:200 K:403 | 200 |
| | layout (List/Grid) | owner or admin | 401 | 403 | 403 | S:200 K:403 | 200 |
| /api/admin/style | GET; POST update, reset, restore | owner or admin | 401 | 403 | 403 | S:200 K:403 | 200 |
| /api/admin/venue | GET; POST update | owner or admin | 401 | 403 | 403 | S:200 K:403 | 200 |
| | POST create ("+ Add venue") | owner or admin | 401 | 403 | 403 | 200, then 403 on the new venue (S1-11) | 200 |
| /api/admin/upload | photo | edit the venue | 401 | S:200 K:403 | S:403 K:200 | S:200 K:403 | 200 |
| | logo | owner or admin | 401 | 403 | 403 | S:200 K:403 | 200 |
| /api/admin/welcome-scene | GET | edit the venue (staff included, ruled 2026-10-09) | 401 | S:200 K:403 | S:403 K:200 | S:200 K:403 | 200 |
| /api/admin/undo | one's own fresh record | the person who made it | 401 | 200 | 200 | 200 | 200 |
| | someone else's record (e.g. the owner's notes, Confirm, layout) | refused | | **403** (*fixed*; was 200) | | | |
| | one's own record over someone else's later change | refused | | **409** (*fixed*; was 200) | | | |
| | the other venue's record | refused | | 404 | | | |
| /api/admin/pin (form) | create a PIN for one's own venues | owner or admin | 401 | 403 | 403 | 200 | 200 |
| | create a PIN for another venue | admin, or that venue's owner | 401 | | | **403** (*fixed*; was 200) | 200 |
| | revoke a PIN of another venue | admin, or that venue's owner | | | | **403** (*fixed*; was 303) | 303 |
| /api/admin/alert (form) | seen, unlock | main admin | 401 | 403 | 403 | 403 | 303 |
| /uploads/* | GET, HEAD | public | 200 for real keys; `..`, `%2f`, `%2e%2e` → 404; SVG served sandboxed with `nosniff` | | | | |

Admin pages (App Router; the app defines no server actions): `/admin` signs in or forwards to the person's venue; `/admin/senso` and `/admin/kebab-land` open the editor only for someone who can edit that venue (a forbidden notice otherwise); `?tab=style` and `?tab=details` are owner or admin; `/admin/team` is owner or admin, and since S1-01 an owner sees only their venues' PINs and no admin accounts; `/admin/new` is owner or admin; `/admin/login` redirects to `/admin`. Staff's editor data still carries the venue's notes and research basis (shown only to owner and admin): the PM should confirm this is intended.

**Sessions, as tested after the fixes:** a revoked PIN's earlier session → 401; an admin whose PIN was reset → 401; a deleted admin → 401; forged tokens (no algorithm, edited contents, another key, expired) → 401; a token copied before sign-out → still accepted until its 12 hours end (residual above). Cookie: `Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`, plus `Secure` over https, behind a proxy that sends `X-Forwarded-Proto: https`, or with `COOKIE_SECURE=1`.

## Production environment

| Variable | In production |
|---|---|
| `DATABASE_URL` | Set; TLS as the host requires; the host's pooled connection (each instance opens up to 5) |
| `SESSION_SECRET` | Set: a new random value of 32+ characters, not the laptop's |
| `TRUST_PROXY` | `1` on Vercel (S1-09); never on a host reached directly |
| `COOKIE_SECURE` | `1` |
| `UPLOAD_DIR`, `STORAGE_DRIVER` | Only local disk exists, which cannot work on Vercel (S1-24) |
| `NODE_ENV` | `production` (set by `next start` and by Vercel) |
| `ROSES_NOW`, `ROSES_CHECK_SUITE` | Never set |
| `PREVIEW_BUILD`, `LOCKOUT_*`, `VENUE_CAP_*`, `NEXT_DIST_DIR`, `ROSES_APP_NAME` | Unset |

Secrets: no key, token, password hash, database dump or `.env` file in any stored git object (4,591 files across every branch, 2026-11-02), apart from S1-06 above.

## Not checked

- Real hosting behaviour (Vercel's forwarded-address header, HSTS, scaling, its page cache across regions): nothing is deployed; stated as assumptions from Vercel's documentation.
- Real phones: WebKit stood in for Safari (the real-phone test covers this).
- Forged-request behaviour in Safari and Firefox (Chromium only); the Server Actions denial-of-service advisory was not attempted.
- A full brute force of a short admin PIN (S1-05's times are calculated from measured limits); disk filling through uploads.
- `setup.mjs`, the import builders and the review/seasonal/research apply tools on a fresh clone (they write into the checkout); only the migrations and the import's loader ran on a fresh database (schema identical).
- One reviewer's first browser run, before it blocked outside requests, loaded about 13 linked menu photos from the ordering service's storage (the same requests any visitor makes); every later run blocked them.
