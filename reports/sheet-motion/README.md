# Item popup and section list: slide in, slide out, photo fade, shorter list (Kian, 2026-10-08)

**Item popup.** Slides up from the bottom edge when an item opens (340 ms, ease-out) and slides back down before it closes (260 ms, ease-in; the script keeps the dialog open under a `.closing` class until the exit animation ends). Close, a tap on the dim, Escape and Back all animate out; the dim fades with it. The photo is 4:3; its bottom edge is softened by a slight plain fade to the popup background over its lower 12 % (Kian asked twice for less shade: the first version covered 45 % of the photo, the second 22 %), and the title block starts 8 px inside that edge, so there is no hard crop line. Grid cards no longer carry the description, so the popup is where it reads. The owner's allergen, dietary and halal notes (ruling 10) show in the popup under **Good to know**: Halal / Not halal and each dietary word as chips, "Contains …" for the allergens, then the note in both languages; nothing when they are empty.

**Section list** (the list icon in the tab bar). Same slide in and out. A Close button at the top on the language's start side (left in English, right in Persian), the caption centred, the top row sticky. At most 75 % of the screen so the page and its tab bar stay visible behind it (more room to tap out), scrollable inside. A tap on a section starts the list's exit and the page's smooth scroll in the same frame.

Reduced motion: no animation, open and close at once. CSS and the kit's inline script only: no runtime JavaScript, no new colour tokens, 0 colour literals.

## Measured (`measure.mjs` → `measure.json`; Chromium, iPhone 13 viewport 390 × 664, scratch copy of the working database with Kian's live choices)

| what | measured |
|---|---|
| popup opens | first frame 14 ms after the tap at translateY 411 px (its own height), settled at 0 after 327 ms; dim 0 → 0.45 |
| popup look | `has-photo` set; photo 390 × 293 (4:3); fade strip 35 px tall (12 % of the photo, `linear-gradient` from transparent to the popup background); content margin −8 px; title top 12 px below the photo's bottom edge; Close at 12 px from the left (English) and 12 px from the right (Persian) |
| owner's notes (Majoun) | popup shows "Good to know" with the chips Halal and Vegan, "Contains NUTS" and the note; in Persian: نکات · حلال · Vegan · حاوی NUTS · the Persian note (a dietary word is shown as the owner typed it); an item without notes (Green Mojito) has no such block |
| popup closes (Close button) | `.closing` from 65 ms after the tap, the dialog closed at 332 ms, slid to 386 px with the dim at 0.03 just before |
| Escape · Back | both animate out; closed after 278 ms · 280 ms |
| from a grid card | opens, `has-photo` set |
| list opens | first frame 48 ms after the tap at translateY 498 px, settled after 364 ms |
| list look | 498 px tall = 75 % of the 664 px screen, top at 166 px while the tab bar ends at 124 px (bar visible: true); scrollable (815 px of content in 498 px); Close at 12 px from the left (English) and 12 px from the right (Persian); top row `position: sticky`; 15 sections |
| tap on "Dessert" in the list | exit started 3 ms after the tap, the page scroll 36 ms after it (same or next frame), the list closed at 272 ms; the page scrolled 6953 px, the section's top at 48 px = the bar's bottom, the Dessert tab lit |
| list closes (Close button) | `.closing` from 52 ms, closed at 323 ms |
| reduced motion | the popup is at translateY 0 in its first open frame; Close closes it within one sample (101 ms) with no `.closing` phase |

Screenshots: `sheet-open-en.jpg`, `sheet-open-fa.jpg`, `sheet-open-from-card.jpg`, `sheet-notes-en.jpg`, `sheet-notes-fa.jpg`, `list-open-en.jpg`, `list-open-fa.jpg`, `list-tap-result.jpg`. The other rows of the table were re-measured on the same run (within a few ms of the first).
