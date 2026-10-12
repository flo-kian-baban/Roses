# Seasonal items: hand evidence (2026-10-12)

The feature is described in CLAUDE.md ("Seasonal items"). The acceptance checks run in `npm run check` / `check:full` (the editor, season, preview and admin drills). This folder has the hand checks made before the suite.

## Persian titles: Kian's choice

| Season | English | Persian |
|---|---|---|
| Fall | Fall specials | ویژه‌های پاییز |
| Winter | Winter specials | ویژه‌های زمستان |
| Spring | Spring specials | ویژه‌های بهار |
| Summer | Summer specials | ویژه‌های تابستان |

In `src/lib/seasonal.ts` (`SEASONAL_TITLES`). Drafted on 2026-10-12 with an alternative, پیشنهاد ویژهٔ پاییز (and the same for the other seasons); Kian chose ویژه‌های… for all four (the PM's review, the same day).

## A venue with no seasonal item: the same bytes as before

The test used a scratch copy of the working database with migration 006 applied: every venue has its Seasonal section and no item has seasons. Two builds were made from that copy: `persian` (28af31a, before the feature) and this branch. The pre-rendered pages compared:

- `senso.html`: byte for byte the same (238,321 B)
- `kebab-land.html`: byte for byte the same (189,853 B)
- The stylesheets have the same file names, so the same content: `09zlh_eux08_g.css` (public) and `30oqt55gm2g6z.css` (admin).

The suite's season drill checks the same thing on every run. It renders Kebab Land with its empty Seasonal section and with no Seasonal section at all, and compares the two byte for byte.

## With seasonal items (the scratch copy, through the admin API as a throwaway admin)

The test put four items in each venue's Seasonal section, one per season, and tagged one more item winter only. The page was rendered in fall (the real date).

- **Senso:** the Seasonal section is first in the menu and first in the tabs, titled "Fall specials" / "ویژه‌های پاییز", with the fall item only. The maple-leaf motif (Kian's F1) sits before the title (`senso-en.jpg`, `senso-fa.jpg`). The page shrank from 238,321 B to 232,147 B because the items out of season left their other sections too.
- **Kebab Land:** the same, with a short bar in the brand red before the title, on the start side in both languages (`kebab-land-en.jpg`, `kebab-land-fa.jpg`).
- **Admin, item editor (iPhone 13):** the four chips under the photo, with "Shown in fall only." under them (`admin-item-phone.jpg`).
- **Admin, Style tab preview (laptop):** after Winter was chosen in the bar, the frame's Seasonal section read "Winter specials" 77 ms later; after Spring, 67 ms later. The customers' page still showed fall only.
- **Admin, Menu tab (iPhone 13):** the Seasonal section's name was cut to "Se…" by a "First on the menu" badge. The badge is removed; the hint line under the header says it.

## The full suite on this branch (run 2026-10-12T10-17-19Z)

Every seasonal check passed, and so did every other check except one: the ratchet failed "Senso LCP with uploaded photos" as worsened (worst 8564 ms against 7934 ms allowed). The data changed during the night: Kian's uploaded photos went from 22 to 33. On a copy of that data, Lighthouse on Senso gives:

| Build | LCP (3 runs) |
|---|---|
| `persian` e53a71f (before the seasonal code) | 5191 / 8564 / 8562 ms |
| this branch | 8573 / 8561 / 8564 ms |

Senso's page is byte for byte the same in both builds (238,321 B).
