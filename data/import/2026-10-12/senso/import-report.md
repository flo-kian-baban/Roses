# Senso Fall Menu: import report (2026-10-12)

Senso's printed Fall Menu card, put in Senso's Seasonal section (Kian, via the PM). The content is in `fall-menu.json`. It is applied by `tools/import/seasonal-menu-apply.mjs`, both to the working database and by `npm run setup`.

## Source

- **The card:** `data/raw/senso-fall-menu/2026-10-12/fall-menu-card.jpg` (sha256 `6c2180778bf0…`).
  - It is Kian's photo of the printed card ("Roses SENSO Fall Menu", six items), taken 2026-10-08 01:37:56 UTC and sent on 2026-10-12.
  - The committed copy is upright and has no metadata. The original (`IMG_2313 6.jpeg`, sha256 `de7d23ad9c66…`) carries the phone's location and model, so it stays with Kian (`manifest.json`).
- **The file named in the request, `IMG_2314.HEIC`, is not the card.** It and the five `IMG_2313*.HEIC` files are the six dish photos cropped from the card, with no text.

## Transcription check (the PM's table against the photo)

Every line matches: English name, Persian name, price and description, in this order.

| # | Card | Persian (card) | Price | Description (card) | Check |
|---|---|---|---|---|---|
| 1 | PUMPKIN SOUP | سوپ کدو حلوایی | $7.99 | Creamy pumpkin soup with autumn spices. | matches |
| 2 | SENSO PUMPKIN OMELETTE | املت کدو حلوایی سنسو | $19.99 | Pumpkin omelette with date syrup, tahini, walnuts & pistachios. | matches |
| 3 | PUMPKIN CHEESECAKE | چیزکیک کدو حلوایی | $13.99 | Creamy pumpkin cheesecake with warm seasonal spices. | matches (glare, see below) |
| 4 | PUMPKIN CAKE | کیک کدو حلوایی | $12.99 | Soft, moist pumpkin cake with autumn spices. | matches |
| 5 | PUMPKIN LATTE | لاته کدو حلوایی | $7.99 | Espresso, steamed milk, pumpkin syrup & autumn spices. | matches |
| 6 | WARM PUMPKIN & ICE CREAM | کدو حلوایی گرم با بستنی | $14.99 | Warm pumpkin & vanilla ice cream with date syrup, tahini, walnuts, pistachios, coconut & sesame. | matches |

- **Under the glare, line 3:**
  - The price reads **$13.99**: the last "9" is half under the glare, but its stem and lower curve are visible, and the "1", "3", the point and the first "9" are clear.
  - The description reads **"with warm seasonal spices"**: "with" is faint but legible, and "warm" is clear.
  - The Persian name's first letter (چ) is at the edge of the glare and legible.
- **Line 6:** the end of "CREAM" and the comma after "pistachios" sit behind the card's pumpkin drawing; the text is unambiguous.
- **The card's title is "Fall Menu"**, the title the Seasonal section now has.

## The pumpkin items found before (Senso, English name with "pumpkin" or Persian name with "کدو")

| Item (before) | Persian | Section | Price | Shown | What was done |
|---|---|---|---|---|---|
| Pumpkin Soup | سوپ کدو حلوایی | Appetizer | 7.99 | yes | Card item 1. Placed in the Seasonal section and kept in Appetizer (Kian); tagged fall; description from the card. |
| Pumpkin Omelette | املت کدو حلوایی | Persian Breakfast | 19.99 | yes | Card item 2, renamed "Senso Pumpkin Omelette" / املت کدو حلوایی سنسو. Placed in the Seasonal section and kept in Persian Breakfast (Kian); tagged fall. |
| Pumpkin Cheesecake | چیزکیک کدو حلوایی | Dessert | 13.99 | yes | Card item 3. Placed in the Seasonal section and kept in Dessert (Kian); tagged fall. |
| Pumpkin Cake | کیک کدو حلوایی | Dessert | 12.99 | yes | Card item 4. Placed in the Seasonal section and kept in Dessert (Kian); tagged fall. |
| Pumpkin Latte | لاته کدو حلوایی | Cold Beverage | 7.99 | yes | Card item 5 (Kian: his uploaded photo shows the card's mug). Moved to the Seasonal section, out of Cold Beverage; tagged fall. |
| Pumpkin Sundae | ساندی کدو حلوایی | Senso Signature | 14.99 | yes | Card item 6, renamed "Warm Pumpkin & Ice Cream" / کدو حلوایی گرم با بستنی. Moved to the Seasonal section, out of Senso Signature; tagged fall. |
| Pumpkin Spice Latte | (none) | Hot Beverage | (none) | no | Left as it is (Kian chose the shown Pumpkin Latte as item 5). |

- **Why the PM's plan changed:** the PM's plan reused only the Sundae and the hidden Spice Latte. The four other items already existed with the card's prices, so new items would have duplicated their names. Kian decided the above on 2026-10-12.
- **Every card item reuses an existing item; nothing was created.**
- **Photos stay as they are** (Kian). The Soup, Omelette, Latte and Sundae carry the photos he uploaded on 2026-10-12; the Cheesecake and Cake keep their linked photos.
- **Season tags apply everywhere:** an item tagged fall is hidden everywhere outside fall. So outside fall, items 1–4 also leave Appetizer, Persian Breakfast and Dessert.
- **Two older pairs of Senso items share an English name, not touched:**
  - Brewing Coffee: a hidden website-only item beside the shown Mealsy one with two sizes.
  - Espresso: the same.
  - Both come from the import of 2026-10-07. They are listed here for the client, not changed.

## Persian

- **Names:** the card's text, recorded as source (no draft flag).
- **Descriptions:** drafts for Kian's review in the admin, flagged per field (`fa_draft` = `description`):

| # | English (card) | Persian draft |
|---|---|---|
| 1 | Creamy pumpkin soup with autumn spices. | سوپ خامه‌ای کدو حلوایی با ادویه‌های پاییزی. |
| 2 | Pumpkin omelette with date syrup, tahini, walnuts & pistachios. | املت کدو حلوایی با شیره خرما، ارده، گردو و پسته. |
| 3 | Creamy pumpkin cheesecake with warm seasonal spices. | چیزکیک خامه‌ای کدو حلوایی با ادویه‌های گرم فصل. |
| 4 | Soft, moist pumpkin cake with autumn spices. | کیک نرم و مرطوب کدو حلوایی با ادویه‌های پاییزی. |
| 5 | Espresso, steamed milk, pumpkin syrup & autumn spices. | اسپرسو، شیر بخارداده، سیروپ کدو حلوایی و ادویه‌های پاییزی. |
| 6 | Warm pumpkin & vanilla ice cream with date syrup, tahini, walnuts, pistachios, coconut & sesame. | کدو حلوایی گرم و بستنی وانیلی با شیره خرما، ارده، گردو، پسته، نارگیل و کنجد. |

- **Wording choices:**
  - "date syrup" is شیره خرما, as in Senso's reviewed Majoun description.
  - "tahini" is ارده, as in a Persian breakfast.
  - "steamed milk" is شیر بخارداده.

## How it is applied

- **Each item:** in Senso's Seasonal section at its card position, tagged fall only, shown, with the card's title-case name, price and description.
- **Records:** one revision row per item, by `{ kind: 'record', id: 'data/import/2026-10-12/senso/fall-menu.json', name: 'Kian' }`, with the before and after snapshots in the admin's shape. A re-import never overwrites it; it only rewrites rows whose author kind is `import`.
- **Applied once:** a re-run leaves an item edited since in the admin as it is.
- **No duplicates:** it refuses a record whose names another Senso item already has.
- **Tested:**
  - on a scratch copy of the working database, twice: 6 applied, then 6 unchanged;
  - on an empty database, the way `npm run setup` does it (migrations, both imports, the Persian review record, this record): the same six items with the same tags, placements, prices and flags.
