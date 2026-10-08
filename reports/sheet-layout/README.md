# Item popup layout, after the Uber Eats reference (Kian, 2026-10-08)

Kian: "The details page for each item does not have perfect layout, it can be much better" (with the Uber Eats screens and his
own screenshot of the Persian Majoun popup). Before: the name, the price almost as large as the name, a 16 px airy description,
then "Good to know" and the sizes, options and combo parts as plain headed lists with the same padding as everything else
(`reports/sheet-motion/sheet-notes-en.jpg`, `sheet-notes-fa.jpg`).

**Now.** The popup is built like the Uber Eats item page: the photo, then the **title block** (the name 24 px bold; the price
line 17 px medium with "Serves N" in grey after a dot; the description 15 px reading text), then **one banded group per kind**
in this order: Sizes, each option group (its own name from the data, with Required or Optional under it), Includes, Good to know
(the owner's notes). A group is a full-width band in the popup's light shade with its heading, then rows with hairlines between
them and the amount on the end side. When an item has no price of its own but sizes, the title block shows their span
("$7 – $120") instead of listing the sizes twice. Every amount is kept left-to-right in Persian too ("$7 – $120", "+$4").
16 px side gutters like the page; the bottom clears the home indicator. Nothing else changed: the slide in and out, the
12 % photo fade, the Close button, the section list, the admin preview's tap-to-edit hooks, no runtime JavaScript, 0 colour
literals, no new token (the group bands use the Item popup group's "Photo placeholder" token, relabelled "Photo placeholder
and group bands" in the Style tab).

## Measured on commit 4851e1a (`measure.mjs` → `measure.json`; Chromium, iPhone 13 viewport 390 × 664 and a 1280 × 800 laptop; scratch copy of the working database with Kian's live Style choices)

Six items that between them carry every kind of content the popup can show, each in English and Persian:

| item | why | measured |
|---|---|---|
| Majoun (Senso, from a grid card) | photo, description, the owner's notes | title 24 px / 700, 16 px from the start edge, 12 px under the photo (390 × 293); price "$21.99" 17 px / 500; description 15 px / 22.5 px; one group "Good to know" / "نکات": chips Halal · Vegan (حلال · Vegan), "Contains NUTS" / "حاوی NUTS", the note in each language; 24 px under the last line; popup 611 px = 92 % of the screen (scrolls 12 px in English, fits in Persian at 602 px) |
| Brewing Coffee Medium (Senso) | an optional option group with a +$ price | group "Choose Your Side" / "انتخاب همراه" with "Optional" / "اختیاری" (13 px) under the 17 px / 700 heading; 5 rows, 15 px, 12 px above and below, 1 px hairline between rows and none after the last; "+$4" in grey 16 px from the end edge (right in English, left in Persian), the plus left of the figure in both languages |
| Ice Cream (Senso) | a required option group of seven | "Choose Your Ice Cream" / "انتخاب بستنی" with "Required" / "الزامی"; 7 rows, no amounts; scrolls inside |
| Ketel One (Kebab Land) | no photo, no description, two sizes | title 16 px under the Close button; the price span "$7 – $120" (the low figure left of the high one in both languages); group "Sizes" / "اندازه‌ها" with "$7" and "$120" in the price colour on the end side; popup 308 px = 46 % of the screen, no scroll |
| Kaseh Kebab (Kebab Land) | photo, Serves 2, combo parts with a quantity | price line "$84.99 · Serves 2" / "$84.99 · برای 2 نفر" (Serves in grey, weight 400); group "Includes" / "شامل" with 4 rows, "2× Bazari Koobideh kebab" |
| Mixed Appetizer (Kebab Land) | no photo, description, combo parts | title 16 px under the Close button; group "Includes" with 3 rows; popup 408 px = 61 %, no scroll |

Common to every case: the band is the full width of the popup (inset 0, 390 of 390 px) in `--c-sheet-hero` (#f3f3f3 on both
venues); the hairlines are `--c-sheet-line`; 24 px of clearance after the last element (measured at the end of the scroll when
the popup scrolls; plus the safe-area inset on a real iPhone); the popup never exceeds 92 % of the screen.

Laptop (1280 × 800): the centred card is 576 px wide and 720 px tall (90 % of the screen), scrolls inside, same groups
(`majoun-en-laptop.jpg`, `coffee-en-laptop.jpg`).

Screenshots: `<item>-<lang>.jpg` at the top of the popup and `<item>-<lang>-end.jpg` scrolled to its end when it scrolls.
