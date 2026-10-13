# Menu research applied to the working database (2026-10-13 00:11 UTC; Kian via the PM, 2026-10-12)

Scope: every item shown on Senso (140) and Kebab Land (102) on 2026-10-12. Records: `data/import/2026-10-12/<venue>/research.json`, with `research-report.md` beside each (rules followed, counts, contradictions, items for the venue to confirm, the build agent's edits, every item's draft and basis, every new description). Review sheets: `reports/research-review-senso.csv`, `reports/research-review-kebab-land.csv`.

## What was done, in order

1. `npm run db:backup` equivalent before the migration: `backups/roses-20261013T001038Z-before-007.dump` (main checkout, gitignored).
2. Migration `007_research_drafts.sql` on the working database (`items.drafts`).
3. Port 3000 rebuilt from this branch (commit a5dee14) and restarted **before** any draft was written, so the old renderer (which shows `notes.allergens` as they are) never regenerated a page with a draft in it.
4. `tools/import/research-frozen.mjs snapshot` → `frozen-before.json` (00:11:09 UTC); `tools/import/research-apply.mjs` for each venue (`apply-senso.txt`, `apply-kebab-land.txt`), each taking a `pg_dump` first; `frozen-after.json`; `frozen-compare.json`. A second run of both records applied nothing (`alreadyApplied` 140 and 102).
5. The review sheets exported from the working database and read back unchanged with `--dry`: 0 changed (140 and 102 rows).
6. Port 3000 rebuilt again so its pre-rendered pages carry the new descriptions.

Backup naming flaw found and fixed: the two venue applies ran in the same second and wrote the same backup name, so `roses-20261013T001109Z-before-research.dump` holds the state after Senso, before Kebab Land; the state before any research write is `roses-20261013T001038Z-before-007.dump` (the migration added an empty column only). The apply now puts the venue in the backup name.

## Acceptance

| Criterion | Result | Evidence |
| --- | --- | --- |
| Names, prices and sections: 0 rows changed | 0 names, 0 prices (price, sizes, add-on prices), 0 sections (placements and section rows), 0 listing, 0 seasons; 385 items and 35 sections before and after | `frozen-compare.json` |
| Every shown item has an English and a Persian description | Senso: English 45 existing + 95 new, Persian 46 existing + 94 new (Allergy Herbal Tea had Persian only); Kebab Land: English 61 + 41, Persian 61 + 41 | `apply-*.txt`; the research drill's `coverage-*` |
| Every shown item has an allergen draft with a basis | Senso 139 drafts + 1 owner's own note kept (Majoun: allergens "NUTS", dietary "Vegan", set by Kian; the research is in its basis and the conflict is flagged); Kebab Land 102 drafts; every one with key ingredients and a source URL | `apply-*.txt`; `basis-*` |
| Every ingredient named in a description is in its allergens (script) | Senso 200 ingredient mentions, Kebab Land 56, every one reflected (English and Persian, existing and new descriptions) | `scripts/research-drill.mjs` `lexicon-*` with `tools/import/research-lexicon.mjs` |
| Health-claim scan of the new descriptions: 0 hits | 0 hits in 271 new descriptions (136 English, 135 Persian); superlatives 0; English ≤ 25 words | `claims`; word list below |
| Public HTML: no unconfirmed allergen or dietary note; the notice in both languages | none of the 241 drafts' allergens or dietary words in either page; the only "Contains" line is Majoun's (Kian's own note); the notice in English and Persian on both pages | `public-*`, `notice-*` |
| Review sheet rows per venue; round trip with no changes | Senso 140, Kebab Land 102; read back unchanged: 0 changed | the sheets; `csv-*` |
| `npm run check` passes | see the suite run committed with this batch | `reports/checks/<stamp>/report.md` |

Sources: every source URL of both records (151 distinct) was requested again by the build agent on 2026-10-13, one per 1.2 s with a User-Agent: `source-urls.txt` (status, URL).

Health-claim words scanned (English and Persian, whole words): detox, cleanse, cleansing, immune, immunity, boost, boosts, boosting, cure, cures, heal, heals, healing, remedy, medicinal, therapeutic, digest, digestion, digestive, metabolism, antioxidant, antioxidants, anti-inflammatory, inflammation, weight, slimming, fat-burning, healthy, health, healthier, wellness, nourishing, vitamin, vitamins, protein, energy, energizing, energising, calming, relaxing, soothing, soothe, soothes, stress, sleep, allergy, allergies, cancer, hormone, hormones, superfood, guilt-free, good for you, سم‌زدایی، سم زدایی، پاکسازی، ایمنی، تقویت، درمان، شفا، دارویی، گوارش، هضم، متابولیسم، آنتی‌اکسیدان، التهاب، لاغری، چربی‌سوز، سالم، سلامت، سلامتی، ویتامین، پروتئین، انرژی، آرام‌بخش، آرامش، آرامش‌بخش، تسکین، استرس، خواب، حساسیت، سرطان، مقوی، مفید. Superlatives: best, finest, perfect, perfection, famous, legendary, world-class, ultimate, unbeatable, number one, the most, greatest, unrivalled, unrivaled, بهترین، معروف، بی‌نظیر، بی نظیر، مشهور.

## Existing descriptions that contradict the research (flagged, not fixed)

Senso:
- Majoun: Kian's notes say Vegan and list only "NUTS", but the description has ice cream, cream and honey (not vegan) and names peanut, sesame and dairy; the note text "Hi this is a note" looks like a test entry.
- Del Roba: English "To lemon" is به‌لیمو, lemon verbena (not lemon); English "saffron plant" is نبات زعفرانی, saffron rock candy, in the Persian; "assochodos" is lavender.
- Digestive Herbal Tea: English "lemon" is به‌لیمو (lemon verbena) and English "rose" is گلاب (rose water) in the Persian, which also has rosebuds (غنچه گل محمدی) where the English says "mohamady flower".
- Power Herbal Tea: English "saffron plant" is نبات زعفرانی, saffron rock candy, in the Persian.
- Women's Life Herbal Tea: English "lemon" is به‌لیمو (lemon verbena) in the Persian.
- Sausage & Egg, and Sausage, Egg & Tomato: the names say sausage (سوسیس); both descriptions say "slice of beef" / برش گوشت گاو and name no sausage.
- Gheymagh: the English lists clotted cream, cream, honey, feta cheese and bread; the Persian names only clotted cream, cream and honey.
- Mama pizza (Grilled chicken Salami,beef bacon): the name lists salami; both descriptions list diced beef instead and no salami.

Kebab Land:
- Fresh Berry Mojito-Virgin: English and Persian describe rosé wine with fruit and citrus (the Red Wine Sangria text word for word); a virgin berry mojito has no wine, and its text names neither mint nor berries.
- Red Wine Sangria: the name says red wine; English and Persian describe rosé wine.
- Black Russian: English and Persian describe plain vodka served neat or on the rocks; a Black Russian is vodka with coffee liqueur.
- Tutti Trend: English and Persian are the generic piña colada definition, apparently copied; nothing in the name says it is a piña colada.

Existing wording noted, not a contradiction and not changed: Sultan's Goblet's text says "best-kept" / بهترین (a superlative, the venue's own words); Electric Margarita's Persian uses پرانرژی ("energetic"); eleven existing Persian names and descriptions on Senso use the Arabic letters ي / ك / ى (e.g. حليم، سوسيس تخم مرغ، قيماق).

## The general allergy notice (every venue's page, from this batch)

- English (the PM's text): Please tell your server about any allergies before ordering. Our dishes may contain or come into contact with common allergens.
- Persian (draft for Kian): لطفاً پیش از سفارش، هرگونه حساسیت غذایی را به همکاران ما اطلاع دهید. غذاهای ما ممکن است حاوی مواد حساسیت‌زای رایج باشند یا با آن‌ها در تماس قرار بگیرند.

## Files

`frozen-before.json`, `frozen-after.json`, `frozen-compare.json`, `apply-senso.txt`, `apply-kebab-land.txt`, `samples.md` (ten items per venue, from the working database; `samples.mjs` writes it), `source-urls.txt`.

## Placeholders withdrawn (Kian's ruling, 2026-10-13 02:26 UTC)

Six research-written descriptions that only pointed to the server (Senso Waffle; Chicken Rolled Fillet, Rolled Fillet Kebab, Soft Drink, Persian Dreams, Venato (Italy)) were cleared by `tools/import/research-apply.mjs` from the records' `withdrawn` entries, after a backup per venue (`backups/roses-20261013T022620Z-before-research-<venue>.dump`, main checkout): English and Persian, their draft flags with them; their allergen drafts kept. `withdraw-frozen-compare.json`: names, prices, sections, listing and seasons 0 rows changed; a second run withdrew nothing. `owner-to-write.md` lists them with what the owner needs to say. The review sheets were exported again (14 columns: "proposed fix" and "apply fix" added) and read back with `--dry`: 0 changes, 0 fixes applied; the 13 rows with a proposed fix come first (Fresh Berry Mojito-Virgin first on Kebab Land). Counts now: Senso English 45 existing + 94 new, Persian 46 + 93; Kebab Land English 61 + 36, Persian 61 + 36; 6 items for the owner to write. Files: `withdraw-frozen-before.json`, `withdraw-frozen-after.json`, `withdraw-frozen-compare.json`, `withdraw-apply-senso.txt`, `withdraw-apply-kebab-land.txt`.
