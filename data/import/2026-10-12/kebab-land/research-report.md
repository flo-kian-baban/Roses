# Menu research — Roses Kebab Land (2026-10-12)

Record: `research.json` beside this file (102 items: every item shown on the venue's page on 2026-10-12). Applied by `tools/import/research-apply.mjs` (also step 7 of `npm run setup`), reviewed in `reports/research-review-kebab-land.csv` and read back by `tools/import/research-review-apply.mjs`. Written by the research, recorded as "Research".

## Rules followed (Kian via the PM, 2026-10-12)

- Names, prices, sections and every existing text are never changed. A description is written only where the field is empty: English and Persian; where one language existed, the other is written from it (same ingredients, nothing added).
- Style: 1–2 short lines, at most 25 English words: the key ingredients and why the item is worth ordering, not a recipe. Voice: a Persian grill with a friendly bar. Persian written as a Persian menu reads, not a literal translation; Western digits.
- No superlatives about the venue or the dish, no health, medical or nutrition claims, even where the item's name implies one (the names are the venue's decision, ruling 11, and stay as they are). The word lists: `tools/import/research-lexicon.mjs` (`CLAIM_WORDS`, `SUPERLATIVES`).
- Every ingredient a description names (the existing ones included) is in the item's key ingredients, and its allergen is in the allergen draft (checked by `scripts/research-drill.mjs` with the lexicon in `tools/import/research-lexicon.mjs`).
- Allergens, "contains" only, never "free-from": Health Canada's priority food allergens plus the other gluten sources, these words only: milk (شیر), egg (تخم‌مرغ), wheat (گندم), barley (جو), oats (جو دوسر), rye (چاودار), tree nuts (مغزهای درختی), peanuts (بادام‌زمینی), sesame (کنجد), soy (سویا), mustard (خردل), fish (ماهی), crustaceans (سخت‌پوستان), molluscs (نرم‌تنان), sulphites (سولفیت). Optional add-ons are the customer's choice: their allergens are in the item's note, not in its allergens. A distilled spirit does not get the grain it is made from.
- Dietary: Vegetarian or Vegan only, as drafts; empty when unsure (wine, beer and spirits included, which may be fined with animal products). Never gluten-free, dairy-free or nut-free; halal never set.
- Basis per item: the assumed key ingredients and one source URL for the dish or drink type (Wikipedia where it has an article; every URL answered 200 when it was recorded).
- Customers: the new descriptions are shown (marked as drafts in the admin: English "Draft", Persian "Persian draft"); the allergen and dietary drafts are not in the public HTML until an owner or admin confirms them (Confirm in the item editor, or "yes" in the review sheet).

## Counts

| | Items |
| --- | --- |
| In the record (shown items) | 102 |
| New English descriptions | 36 |
| New Persian descriptions (Persian drafts) | 36 |
| Placeholders withdrawn, for the owner to write | 5 |
| Contradictions flagged, each with a proposed fix | 4 / 4 |
| With at least one allergen in the draft | 75 |
| No priority allergen found in the typical recipe | 27 |
| Dietary draft Vegetarian / Vegan / none | 11 / 7 / 84 |
| Confidence high / medium / low | 31 / 61 / 10 |

Allergens across the drafts: milk 45, egg 4, wheat 7, barley 5, rye 1, tree nuts 15, sesame 3, soy 1, fish 3, molluscs 2, sulphites 18.

## Existing descriptions that contradict the research (flagged, not fixed)

| Item | Why |
| --- | --- |
| Tutti Trend | EN and FA are the generic piña colada definition ('just four primary ingredients: white rum, pineapple juice, cream of coconut, and ice'), apparently copied; nothing in the name 'Tutti Trend' says it is a piña colada. |
| Red Wine Sangria | The name says red wine, but EN and FA describe rosé wine (شراب رزه); the same text, word for word, is on Fresh Berry Mojito-Virgin. |
| Fresh Berry Mojito-Virgin | EN and FA describe rosé wine with fruit and citrus (the Red Wine Sangria text word for word); a virgin berry mojito has no wine, and its text names neither mint nor berries. |
| Black Russian | EN and FA describe plain vodka served neat or on the rocks; a Black Russian is vodka with coffee liqueur (IBA: 50 ml vodka, 20 ml coffee liqueur). |

## Changes the build agent made to the research drafts (before the record was written)

- Ketel One: the description names wheat: wheat drafted (the PM's rule), with the distillation note
- Grey Goose: the description names wheat: wheat drafted (the PM's rule), with the distillation note
- Crown Royal: the description names rye, corn and barley: rye, barley drafted (the PM's rule), with the distillation note
- Jameson: the description names malted and unmalted barley: barley drafted (the PM's rule), with the distillation note
- Black Label: barley drafted like the other whiskies for consistency (its description names no grain), with the distillation note
- Glenfiddich 12: the description names malted barley: barley drafted (the PM's rule), with the distillation note
- Aragh Sagi: the description names raisins: sulphites drafted (the PM's rule)
- Sultan’s Goblet: no ingredient known: the basis says so instead of staying empty
- Persian Dreams: no ingredient known: the basis says so instead of staying empty
- Merlot (France): the descriptions name wine; "wine" added to the key ingredients beside the grape
- Shiraz (Australia): the descriptions name wine; "wine" added to the key ingredients beside the grape
- Cabernet: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Venato (Italy): the descriptions name wine; "wine" added to the key ingredients beside the grape
- Borsao (Spain): the descriptions name wine; "wine" added to the key ingredients beside the grape
- Bordeaux (France): the descriptions name wine; "wine" added to the key ingredients beside the grape
- Pinot Noir (France): the descriptions name wine; "wine" added to the key ingredients beside the grape
- Pinot Grigio: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Sauvignon Blanc: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Chardonnay: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Shiraz: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Cab Sauv: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Merlot: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Rose: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Prosecco: the descriptions name wine; "wine" added to the key ingredients beside the grape
- Mixed Appetizer: a choice between two components is part of the dish, not an optional extra: the allergen of either is drafted
- Kian, 2026-10-13: Chicken Rolled Fillet, Rolled Fillet Kebab, Soft Drink, Persian Dreams, Venato (Italy): placeholder descriptions withdrawn (cleared where still the research's draft; allergen drafts kept); every contradiction carries a proposed fix, applied only when its row is ticked in the review sheet

## Withdrawn placeholders: for the owner to write (Kian, 2026-10-13)

| Item | The text withdrawn (English) | Why |
| --- | --- | --- |
| Chicken Rolled Fillet | Rolled chicken fillet, one of the chef's specials. Ask your server how it is prepared and served. | placeholder that only points to the server: cleared on Kian's ruling of 2026-10-13 (its allergen draft stays); the owner writes it (reports/menu-research/owner-to-write.md) |
| Rolled Fillet Kebab | Rolled fillet, skewered and grilled; one of the chef's specials. Ask your server how it is prepared. | placeholder that only points to the server: cleared on Kian's ruling of 2026-10-13 (its allergen draft stays); the owner writes it (reports/menu-research/owner-to-write.md) |
| Soft Drink | A chilled soft drink; ask your server for today's choices. | placeholder that only points to the server: cleared on Kian's ruling of 2026-10-13 (its allergen draft stays); the owner writes it (reports/menu-research/owner-to-write.md) |
| Persian Dreams | Our house cocktail, mixed at the bar; your server can tell you what goes into it. | placeholder that only points to the server: cleared on Kian's ruling of 2026-10-13 (its allergen draft stays); the owner writes it (reports/menu-research/owner-to-write.md) |
| Venato (Italy) | A bottle of Italian wine; ask your server about the producer, grape and vintage. | placeholder that only points to the server: cleared on Kian's ruling of 2026-10-13 (its allergen draft stays); the owner writes it (reports/menu-research/owner-to-write.md) |

## Proposed fixes for the contradictions (applied only when ticked in the review sheet)

| Item | Proposed English | Proposed Persian | Notes | Why |
| --- | --- | --- | --- | --- |
| Fresh Berry Mojito-Virgin | Fresh mint, lime and mixed berries topped with soda — a sweet, cool mojito with no alcohol. | نعنای تازه، لیموترش و توت‌های تازه با سودا — موهیتویی شیرین و خنک، بدون الکل. | {"allergens":[],"keepDraft":true} | the text was the Red Wine Sangria text (rosé wine) on an alcohol-free drink; the fix names what a virgin berry mojito is, and its allergen draft loses the sulphites the wine brought (still a draft) |
| Red Wine Sangria | Red wine, fresh fruit, and a splash of citrus — light, fruity, and refreshing. | شراب قرمز، میوه تازه و کمی مرکبات — سبک، میوه‌ای و خنک. | — | the name says red wine, the text said rosé; only the wine changes |
| Black Russian | Simple and bold — vodka and coffee liqueur over ice. | ساده و پرقدرت — ودکا و لیکور قهوه روی یخ. | — | a Black Russian is vodka with coffee liqueur; the text described plain vodka |
| Tutti Trend | Tropical cocktail of white rum, pineapple juice and cream of coconut over ice. | کوکتل استوایی با رام سفید، آب آناناس و کرم نارگیل روی یخ. | — | the text was a copied piña colada definition ("just four primary ingredients"); the fix keeps the same ingredients in the venue's own words; the venue confirms it is this drink |

## For the venue to confirm (low confidence)

| Item | What the venue must confirm |
| --- | --- |
| Jojeh Avocado | House recipe; kitchen to confirm the garlic sauce (mayonnaise adds egg, yogurt adds milk), rice (assumed) and butter on it. |
| Chicken Rolled Fillet | Recipe not public: venue to confirm the filling, marinade and sides (cheese or buttered rice would add milk). |
| Rolled Fillet Kebab | Recipe not public: venue to confirm the meat (assumed beef fillet, as in the Fillet Chenjeh), any filling, marinade and sides. |
| Local Yogurt Moosir | Listed under Drinks: venue to confirm whether it is a drink (doogh) or the yogurt itself, and what 'local' (mahali) means here. |
| Tutti Trend | House cocktail: venue to confirm it is the piña colada its text describes (some recipes add cream, which is milk). |
| Sultan’s Goblet | Recipe kept secret: venue to confirm the spirits and any allergens. Existing text uses 'best-kept' / بهترین (venue's wording). |
| Persian Dreams | Recipe not public: venue to confirm the spirits and ingredients before the description names any. |
| Silk Rose Martini | House recipe not public: venue to confirm the rose element and what makes it 'silk' (cream = milk, egg white = egg); its text is close to Rose Water Martini's. |
| Venato (Italy) | 'Venato' not found as an Italian wine (perhaps the Veneto region): venue to confirm the wine, colour and grape. |
| Borsao (Spain) | Which Borsao wine to confirm (mostly Garnacha reds; also rosé and white). |

## Items whose names carry a health claim (names kept; descriptions describe taste and ingredients only)

None.

## Every item: draft and basis

| Item | Allergens (draft) | Dietary (draft) | Key ingredients | Source | Confidence | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Green Salad | — | Vegetarian | lettuce, cucumber, tomato | [Salad](https://en.wikipedia.org/wiki/Salad) | medium | Venue to confirm the vegetables and the dressing; Vegan if the dressing has no honey, yogurt or egg. |
| Yogurt with Shallot Dip (Maast o Moosir) | milk | Vegetarian | yogurt, persian shallot, salt | [Allium stipitatum](https://en.wikipedia.org/wiki/Allium_stipitatum) | high | No English Wikipedia article for the dip; the Persian shallot article describes musir crushed into yogurt in kebab houses. |
| Baba Ghanoosh | sesame | Vegan | eggplant, tahini, garlic, lemon juice, olive oil, salt | [Baba ghanoush](https://en.wikipedia.org/wiki/Baba_ghanoush) | medium | Kitchen to confirm: tahini (sesame) and garlic in the house recipe. |
| Fried Eggplant | — | Vegetarian | eggplant, vegetable oil, salt | [Fried eggplant](https://en.wikipedia.org/wiki/Fried_eggplant) | medium | Kitchen to confirm: no flour or egg coating and no topping (yogurt or kashk would add milk); Vegan if none. |
| Kashke Bademjan | milk, tree nuts | Vegetarian | eggplant, kashk (whey), garlic, mint, onion, walnut, saffron, vegetable oil | [Kashk bademjan](https://en.wikipedia.org/wiki/Kashk_bademjan) | high | Kitchen to confirm: walnut garnish (often used; tree nuts). |
| Zeytoon Parvarde | tree nuts | Vegan | green olive, walnut, pomegranate molasses, garlic, mint, parsley, olive oil | [Zeytoon parvardeh](https://en.wikipedia.org/wiki/Zeytoon_parvardeh) | high |  |
| Mixed Appetizer | milk, tree nuts, sesame | Vegetarian | yogurt, persian shallot, green olive, walnut, pomegranate molasses, garlic, mint, parsley, olive oil, eggplant, vegetable oil, salt | [Meze](https://en.wikipedia.org/wiki/Meze) | high | Sesame drafted because one of the two choices, Baba Ghanoosh, is made with tahini (sesame); the other, fried eggplant, has none: the popup cannot say which, so the draft keeps it. Customer's choice: Baba Ghanoosh adds sesame (tahini); Fried Eggplant adds none. |
| Mixed Appetizer Platter | milk, tree nuts, sesame | Vegetarian | eggplant, tahini, lemon juice, garlic, olive oil, green olive, walnut, pomegranate molasses, mint, parsley, kashk (whey), onion, saffron, vegetable oil, yogurt, persian shallot, salt | [Meze](https://en.wikipedia.org/wiki/Meze) | high | Kitchen to confirm: tahini in the Baba Ghanoosh (sesame), walnut on the Kashke Bademjan. |
| Bazari Koobideh Kebab | milk | — | ground beef, onion, salt, black pepper, basmati rice, saffron, butter | [Kabab koobideh](https://en.wikipedia.org/wiki/Kabab_koobideh) | high | Kitchen to confirm: butter on the rice (milk); no egg, flour or breadcrumb binder (traditional koobideh has none). |
| Roses Koobideh Kebab | milk | — | ground beef, ground chicken, onion, salt, black pepper, basmati rice, saffron, butter | [Kabab koobideh](https://en.wikipedia.org/wiki/Kabab_koobideh) | medium | House beef-and-chicken mix; kitchen to confirm: any egg or breadcrumb binder, butter on the rice (milk). |
| Barg Kebab | milk | — | beef tenderloin, onion, olive oil, garlic, saffron, salt, black pepper, basmati rice, butter | [Kabab barg](https://en.wikipedia.org/wiki/Kabab_barg) | high | Kitchen to confirm: butter on the rice and any butter baste (milk). |
| Fillet Chenjeh Kebab | milk | — | beef tenderloin, onion, olive oil, lemon juice, salt, black pepper, basmati rice, saffron, butter | [Iran Chamber Society: Iranian Recipes & Cuisines](https://www.iranchamber.com/recipes/meat/kabab_chenjeh.php) | medium | Chenjeh is classically lamb; this one is beef fillet. Kitchen to confirm: yogurt in the marinade (some recipes), butter on the rice (milk). |
| Gilaki Sour Kebab | milk, tree nuts | — | beef sirloin, pomegranate juice, walnut, parsley, garlic, olive oil, basmati rice, saffron, butter | [Kabab torsh](https://en.wikipedia.org/wiki/Kabab_torsh) | medium | Kitchen to confirm: crushed walnut in the marinade (typical of kabab torsh; tree nuts), butter on the rice (milk). |
| Chicken Leg Kebab | milk | — | chicken leg, onion, lemon juice, saffron, basmati rice, butter | [Jujeh kabab](https://en.wikipedia.org/wiki/Jujeh_kabab) | high | Kitchen to confirm: butter on the rice (milk); yogurt in the marinade, if used, also adds milk. |
| Chicken Breast Kebab | milk | — | chicken breast, onion, lemon juice, saffron, basmati rice, butter | [Jujeh kabab](https://en.wikipedia.org/wiki/Jujeh_kabab) | high | Kitchen to confirm: butter on the rice (milk); yogurt in the marinade, if used, also adds milk. |
| Shekari Chicken Kebab | milk | — | chicken breast, onion, spices, saffron, basmati rice, butter | [Jujeh kabab](https://en.wikipedia.org/wiki/Jujeh_kabab) | medium | House spice mix and marinade not public; kitchen to confirm them and butter on the rice (milk). |
| Akbar Joojeh | milk | — | baby chicken, onion, garlic, lime juice, vegetable oil, pomegranate molasses, basmati rice, saffron, butter | [Roast Chicken & Saffron Rice \| My Caldron](https://mycaldron.com/2017/12/17/roast-chicken-saffron-rice/) | medium | No Wikipedia article. Kitchen to confirm: no flour coating before frying (none in typical recipes; wheat if used), butter on the rice (milk). |
| Darbari Chicken Kebab | milk | — | chicken breast, saffron, onion, lemon juice, spices, basmati rice, butter | [Jujeh kabab](https://en.wikipedia.org/wiki/Jujeh_kabab) | medium | House marinade not public; kitchen to confirm it (yogurt would add milk) and butter on the rice (milk). |
| Shishlik Kebab | milk | — | lamb chop, onion, saffron, lemon juice, black pepper, spices, basmati rice, butter | [Shashlik](https://en.wikipedia.org/wiki/Shashlik) | high | Kitchen to confirm: yogurt in the marinade (common in Persian shishlik) and butter on the rice (milk). |
| Bakhtiari Kebab | milk | — | chicken breast, beef tenderloin, onion, saffron, lemon juice, olive oil, basmati rice, butter | [List of kebabs](https://en.wikipedia.org/wiki/List_of_kebabs) | medium | Bakhtiari = jujeh and barg together; kitchen to confirm the cuts, marinade and butter on the rice (milk). |
| Special Bonab Kebab | milk | — | ground beef, onion, salt, black pepper, spices, basmati rice, tomato, butter | [Bonab kababi](https://en.wikipedia.org/wiki/Bonab_kababi) | medium | Bonab kebab is traditionally ground mutton; this one is described as beef. Kitchen to confirm: butter on the rice (milk). |
| Rainbow Fish | fish, tree nuts | — | rainbow trout, pomegranate, walnut, salt | [Rainbow trout](https://en.wikipedia.org/wiki/Rainbow_trout) | medium | Sides not stated; kitchen to confirm the topping (arils or molasses), any butter or flour, and whether rice comes with it. |
| Stone Lamb Shanks | — | — | lamb shank, onion, garlic, turmeric, cinnamon, saffron, tomato paste, herbs | [Persian Braised Lamb Recipe (Mahiche) \| The Mediterranean Dish](https://www.themediterraneandish.com/persian-braised-lamb-shanks-mahiche/) | medium | No Wikipedia article for mahicheh. Recipe not public: kitchen to confirm the braise (stock, spices) and the sides. |
| Jojeh Fesenjooni | milk, tree nuts | — | chicken leg, walnut, pomegranate molasses, onion, basmati rice, saffron, butter | [Fesenjān](https://en.wikipedia.org/wiki/Fesenj%C4%81n) | medium | Fesenjan flavours (walnut, pomegranate) on grilled chicken; rice not stated, assumed; kitchen to confirm butter on the rice (milk). |
| Jojeh Avocado | milk, tree nuts | — | chicken leg, garlic, walnut, avocado, basmati rice, saffron, butter | [Jujeh kabab](https://en.wikipedia.org/wiki/Jujeh_kabab) | low | House recipe; kitchen to confirm the garlic sauce (mayonnaise adds egg, yogurt adds milk), rice (assumed) and butter on it. |
| Jojeh Mix | milk | — | ground chicken, onion, spices, basmati rice, tomato, butter | [Kabab koobideh](https://en.wikipedia.org/wiki/Kabab_koobideh) | medium | Description reads as a minced-chicken koobideh; venue to confirm what 'Mix' means, any egg or breadcrumb binder, butter on the rice. |
| Kaseh Kebab | milk | — | chicken breast, saffron, onion, lemon juice, beef tenderloin, olive oil, ground beef, salt, black pepper, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Kitchen to confirm: the meat of the Chenjeh Tehrani (lamb or beef), butter on the rice (milk). |
| Tabrizi Barg Kebab | milk | — | beef tenderloin, ground beef, onion, olive oil, garlic, saffron, salt, black pepper, basmati rice, butter | [Kabab barg](https://en.wikipedia.org/wiki/Kabab_barg) | medium | Barg and koobideh on one skewer; rice not stated, assumed; kitchen to confirm butter on the rice (milk). |
| Special Chef Dish | milk | — | beef tenderloin, lamb chop, chicken breast, ground beef, onion, saffron, lemon juice, olive oil, salt, black pepper, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Kitchen to confirm: yogurt in the shishlik marinade, butter on the rice (milk). |
| Chicken Rolled Fillet | — | — | chicken fillet | [Roulade](https://en.wikipedia.org/wiki/Roulade) | low | Recipe not public: venue to confirm the filling, marinade and sides (cheese or buttered rice would add milk). |
| Rolled Fillet Kebab | — | — | beef tenderloin | [Roulade](https://en.wikipedia.org/wiki/Roulade) | low | Recipe not public: venue to confirm the meat (assumed beef fillet, as in the Fillet Chenjeh), any filling, marinade and sides. |
| Salari Kebab | milk | — | chicken breast, onion, lemon juice, saffron, ground beef, salt, black pepper, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Rice not stated, assumed as on the single kebab plates; kitchen to confirm butter on the rice (milk). |
| Soltani Kebab | milk | — | beef tenderloin, olive oil, garlic, onion, saffron, ground beef, salt, black pepper, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Rice not stated, assumed as on the single kebab plates; kitchen to confirm butter on the rice (milk). |
| Mohtasham | milk | — | beef tenderloin, olive oil, garlic, onion, saffron, chicken breast, lemon juice, salt, black pepper, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Rice not stated, assumed as on the single kebab plates; kitchen to confirm butter on the rice (milk). |
| Mozaffari Kebab | milk | — | beef tenderloin, olive oil, lemon juice, onion, ground beef, salt, black pepper, saffron, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Chenjeh assumed beef fillet as on the menu; rice not stated, assumed; kitchen to confirm butter on the rice (milk). |
| Amiri Kebab | milk | — | lamb chop, onion, saffron, lemon juice, ground beef, salt, black pepper, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Rice not stated, assumed; kitchen to confirm yogurt in the shishlik marinade and butter on the rice (milk). |
| Vaziri Kebab | milk | — | ground beef, onion, salt, black pepper, chicken leg, lemon juice, saffron, basmati rice, butter | [List of kebabs](https://en.wikipedia.org/wiki/List_of_kebabs) | medium | Vaziri = koobideh and jujeh together; rice not stated, assumed; kitchen to confirm butter on the rice (milk). |
| Yeylaghi | milk, tree nuts | — | beef sirloin, pomegranate juice, walnut, parsley, garlic, olive oil, ground beef, onion, salt, black pepper, basmati rice, saffron, butter | [Kabab torsh](https://en.wikipedia.org/wiki/Kabab_torsh) | medium | Kitchen to confirm: walnut in the sour-kebab marinade (tree nuts), rice (assumed) and butter on it (milk). |
| Platter 1 | milk | — | chicken leg, chicken breast, onion, lemon juice, saffron, ground beef, salt, black pepper, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | high | Kitchen to confirm: butter on the rice (milk). |
| Platter 2 | milk | — | beef tenderloin, olive oil, garlic, chicken leg, lemon juice, onion, saffron, ground beef, salt, black pepper, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | high | Kitchen to confirm: butter on the rice (milk). |
| Platter 3 | milk | — | ground beef, onion, salt, black pepper, beef tenderloin, olive oil, lemon juice, chicken leg, chicken breast, saffron, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | high | Kitchen to confirm: butter on the rice (milk). |
| Platter 4 | milk, tree nuts | — | beef tenderloin, olive oil, garlic, beef sirloin, pomegranate juice, walnut, parsley, ground beef, onion, salt, black pepper, lamb chop, lemon juice, saffron, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Kitchen to confirm: walnut in the sour kebab (tree nuts), yogurt in the shishlik marinade, butter on the rice (milk). |
| Platter 5 | milk | — | chicken breast, chicken leg, onion, lemon juice, saffron, spices, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Darbari and Shekari marinades not public; kitchen to confirm them (yogurt adds milk) and butter on the rice (milk). |
| Platter 6 | milk | — | ground beef, onion, salt, black pepper, beef tenderloin, olive oil, lemon juice, lamb chop, saffron, chicken breast, spices, basmati rice, butter | [Chelow kabab](https://en.wikipedia.org/wiki/Chelow_kabab) | medium | Kitchen to confirm: Shekari spice mix, yogurt in the shishlik marinade, butter on the rice (milk). |
| Walnut Yogurt Drink | milk, tree nuts | Vegetarian | yogurt, water, walnut, salt, dried mint | [Doogh](https://en.wikipedia.org/wiki/Doogh) | medium | House recipe to confirm (herbs; raisins, if added, would add sulphites). |
| Shallot (Moosir) Yogurt Drink | milk | Vegetarian | yogurt, water, persian shallot, salt, dried mint | [Doogh](https://en.wikipedia.org/wiki/Doogh) | high |  |
| Local Yogurt Moosir | milk | Vegetarian | yogurt, persian shallot, salt | [Allium stipitatum](https://en.wikipedia.org/wiki/Allium_stipitatum) | low | Listed under Drinks: venue to confirm whether it is a drink (doogh) or the yogurt itself, and what 'local' (mahali) means here. |
| Soft Drink | — | — | carbonated water, sugar, flavouring | [Soft drink](https://en.wikipedia.org/wiki/Soft_drink) | medium | Venue to confirm which soft drinks and sizes are offered. |
| Baklava | wheat, milk, tree nuts | Vegetarian | filo pastry, butter, pistachio, walnut, sugar syrup | [Baklava](https://en.wikipedia.org/wiki/Baklava) | medium | Venue to confirm the style and nuts (Persian baklava often uses almond and pistachio with rosewater and cardamom). |
| Tiramisu cake | wheat, egg, milk | — | sponge cake, coffee, mascarpone, cream, egg, sugar, cocoa powder | [Tiramisu](https://en.wikipedia.org/wiki/Tiramisu) | medium | Supplier or recipe to confirm: liqueur or Marsala (sulphites) and gelatine; Vegetarian if no gelatine. |
| Pistachio cake | wheat, egg, milk, tree nuts | — | flour, egg, sugar, butter, pistachio | [Cake](https://en.wikipedia.org/wiki/Cake) | medium | Supplier or recipe to confirm (cream or frosting; gelatine would rule out Vegetarian). |
| Nutella cake | wheat, egg, milk, tree nuts, soy | — | flour, egg, sugar, butter, nutella, hazelnut, cocoa, skim milk powder, soy lecithin | [Nutella](https://en.wikipedia.org/wiki/Nutella) | medium | Supplier or recipe to confirm (frosting, gelatine); soy from the soy lecithin Nutella lists in the US and UK, to check on the Canadian label. |
| Caramel and hazelnut cake | wheat, egg, milk, tree nuts | — | flour, egg, sugar, butter, cream, caramel, hazelnut | [Cake](https://en.wikipedia.org/wiki/Cake) | medium | Supplier or recipe to confirm (frosting, gelatine; caramel usually carries butter and cream). |
| Tutti Trend | — | — | white rum, pineapple juice, cream of coconut, ice | [Piña colada](https://en.wikipedia.org/wiki/Piña_colada) | low | House cocktail: venue to confirm it is the piña colada its text describes (some recipes add cream, which is milk). |
| Sultan’s Goblet | — | — | house cocktail (recipe not public) | [Cocktail](https://en.wikipedia.org/wiki/Cocktail) | low | Recipe kept secret: venue to confirm the spirits and any allergens. Existing text uses 'best-kept' / بهترین (venue's wording). |
| Persian Draft Beer | barley | — | barley malt, hops, yeast, water | [Draught beer](https://en.wikipedia.org/wiki/Draught_beer) | medium | Brand and style not named: venue to confirm (add wheat if it is a wheat beer). FA 'آبجوی خانگی' reads as home-brewed rather than house beer. |
| Sake | — | — | rice, koji, yeast, water | [Sake](https://en.wikipedia.org/wiki/Sake) | medium | Brand not named; price 70 next to 'served in a sake cup' and 'bottle shown for display': venue to confirm what the price buys. |
| Classic Mojito | — | Vegan | white rum, mint, lime, sugar, soda water | [Mojito](https://en.wikipedia.org/wiki/Mojito) | high |  |
| Rose Cesar | fish, molluscs | — | vodka, clamato juice (tomato and clam broth), hot sauce, worcestershire sauce, spice, celery salt, lime | [Caesar (cocktail)](https://en.wikipedia.org/wiki/Caesar_(cocktail)) | medium | Kitchen to confirm: Worcestershire sauce (fish, anchovy) and what is in the house rim; molluscs from the clam broth in Clamato. |
| Red Wine Sangria | sulphites | — | red wine, rosé wine, fresh fruit, citrus, orange juice, sugar | [Sangria](https://en.wikipedia.org/wiki/Sangria) | medium | Some sangrias add brandy or a liqueur: venue to confirm the recipe. |
| Persian Dreams | — | — | house cocktail (recipe not public) | [Cocktail](https://en.wikipedia.org/wiki/Cocktail) | low | Recipe not public: venue to confirm the spirits and ingredients before the description names any. |
| Classic Mojito Virgin | — | Vegan | mint, lime, sugar, soda water | [Mojito](https://en.wikipedia.org/wiki/Mojito) | high |  |
| Fresh Berry Mojito-Virgin | sulphites | — | mint, lime, berries, sugar, soda water, rosé wine, fresh fruit, citrus | [Mojito](https://en.wikipedia.org/wiki/Mojito) | medium | Sulphites listed only because the description names rosé wine; a virgin berry mojito typically has none of the listed allergens. |
| Fresh Berry Mojito | — | Vegan | white rum, mint, lime, berries, sugar, soda water | [Mojito](https://en.wikipedia.org/wiki/Mojito) | medium | Which berries to confirm. |
| Cucumber Gin Mojito | — | Vegan | gin, cucumber, mint, lime, sugar, soda water | [Mojito](https://en.wikipedia.org/wiki/Mojito) | medium |  |
| Strawberry, Basil Margarita | — | — | tequila, strawberry, basil, lime juice, triple sec, salt | [Margarita](https://en.wikipedia.org/wiki/Margarita) | medium | Triple sec and a salt rim assumed from the classic margarita: venue to confirm. |
| Silk Rose Martini | — | — | vodka, rose flavouring | [Martini (cocktail)](https://en.wikipedia.org/wiki/Martini_(cocktail)) | low | House recipe not public: venue to confirm the rose element and what makes it 'silk' (cream = milk, egg white = egg); its text is close to Rose Water Martini's. |
| Rose Water Martini | — | — | vodka, rose water, citrus | [Martini (cocktail)](https://en.wikipedia.org/wiki/Martini_(cocktail)) | medium | No vermouth named; if dry vermouth is added, add sulphites: venue to confirm. |
| Long Island Ice tea | — | — | vodka, tequila, white rum, gin, triple sec, lemon juice, simple syrup, cola | [Long Island iced tea](https://en.wikipedia.org/wiki/Long_Island_iced_tea) | high |  |
| Sex on the Beach | — | — | vodka, peach schnapps, cranberry juice, orange juice | [Sex on the beach](https://en.wikipedia.org/wiki/Sex_on_the_beach) | high |  |
| Blue Lagoon | — | — | vodka, blue curaçao, lemonade | [Blue Lagoon (cocktail)](https://en.wikipedia.org/wiki/Blue_Lagoon_(cocktail)) | high |  |
| Tequila Sunrise | — | — | tequila, orange juice, grenadine | [Tequila sunrise](https://en.wikipedia.org/wiki/Tequila_sunrise) | high |  |
| Rose Cesar – Virgin | fish, molluscs | — | clamato juice (tomato and clam broth), rose water, spices, hot sauce, worcestershire sauce, celery salt, lime | [Caesar (cocktail)](https://en.wikipedia.org/wiki/Caesar_(cocktail)) | medium | Kitchen to confirm Worcestershire sauce (fish) and the rim; rose water is named here but not in the alcoholic Rose Cesar. |
| Black Russian | — | — | vodka, coffee liqueur, ice | [Black Russian](https://en.wikipedia.org/wiki/Black_Russian) | high |  |
| Electric Margarita | — | — | tequila, blue curaçao, lime juice, salt | [Margarita](https://en.wikipedia.org/wiki/Margarita) | medium | Salt rim and any triple sec to confirm; existing FA uses پرانرژی (an 'energy' word, venue's wording). |
| Baileys Shot | milk | Vegetarian | irish cream liqueur, cream, cocoa, irish whiskey, sugar | [Baileys Irish Cream](https://en.wikipedia.org/wiki/Baileys_Irish_Cream) | high | The Irish whiskey is distilled (not counted as a grain allergen); the cream is milk. |
| Gin & Tonic | — | Vegan | gin, tonic water, lime, ice | [Gin and tonic](https://en.wikipedia.org/wiki/Gin_and_tonic) | high | Gin is distilled from grain (not counted as a gluten allergen). |
| Jägermeister | — | — | herbal liqueur, herbs, fruit, roots, spices, citrus peel, liquorice, anise, ginger, saffron, sugar | [Jägermeister](https://en.wikipedia.org/wiki/Jägermeister) | high | The full list of 56 botanicals is not public. |
| Ketel One | wheat | — | wheat, water | [Ketel One](https://en.wikipedia.org/wiki/Ketel_One) | high | Distilled from wheat; distillation leaves no gluten protein (Celiac Canada treats distilled spirits as gluten-free), so wheat is drafted only because the description names the grain: Kian to keep or remove. Distilled from 100% wheat; distilled spirits are not counted as a wheat allergen. |
| Grey Goose | wheat | — | wheat, spring water | [Grey Goose (vodka)](https://en.wikipedia.org/wiki/Grey_Goose_(vodka)) | high | Distilled from wheat; distillation leaves no gluten protein (Celiac Canada treats distilled spirits as gluten-free), so wheat is drafted only because the description names the grain: Kian to keep or remove. Distilled from wheat; distilled spirits are not counted as a wheat allergen. |
| Ciroc Peach | — | — | grape, peach flavouring | [Cîroc](https://en.wikipedia.org/wiki/Cîroc) | high | Grape-distilled vodka with peach flavouring; flavoured Cîroc is bottled below 40% (35% ABV in the US). |
| Crown Royal | rye, barley | — | rye, corn, barley | [Crown Royal](https://en.wikipedia.org/wiki/Crown_Royal) | high | Distilled from rye, corn and barley; distillation leaves no gluten protein (Celiac Canada treats distilled spirits as gluten-free), so rye and barley is drafted only because the description names the grain: Kian to keep or remove. Distilled from rye, corn and barley; distilled spirits are not counted as grain allergens. |
| Jameson | barley | — | malted barley, unmalted barley, grain whiskey | [Jameson Irish Whiskey](https://en.wikipedia.org/wiki/Jameson_Irish_Whiskey) | high | Distilled from malted and unmalted barley; distillation leaves no gluten protein (Celiac Canada treats distilled spirits as gluten-free), so barley is drafted only because the description names the grain: Kian to keep or remove. Distilled from barley and grain; distilled spirits are not counted as grain allergens. |
| Black Label | barley | — | malted barley, grain whisky | [Johnnie Walker](https://en.wikipedia.org/wiki/Johnnie_Walker) | medium | Distilled from malted barley and grain; distillation leaves no gluten protein (Celiac Canada treats distilled spirits as gluten-free), so barley is drafted like the other whiskies (its description names no grain): Kian to keep or remove. Assumed Johnnie Walker Black Label (12-year blend): venue to confirm; grain-distilled, not counted as a grain allergen. |
| Glenfiddich 12 | barley | — | malted barley, water | [Glenfiddich](https://en.wikipedia.org/wiki/Glenfiddich) | high | Distilled from malted barley; distillation leaves no gluten protein (Celiac Canada treats distilled spirits as gluten-free), so barley is drafted only because the description names the grain: Kian to keep or remove. Distilled from malted barley; distilled spirits are not counted as a barley allergen. Casks per the brand (American oak and European sherry oak). |
| Merlot (France) | sulphites | — | wine, merlot grape | [Merlot](https://en.wikipedia.org/wiki/Merlot) | medium | Producer and vintage not named: venue to confirm. |
| Shiraz (Australia) | sulphites | — | wine, shiraz grape | [Syrah](https://en.wikipedia.org/wiki/Syrah) | medium | Producer and vintage not named: venue to confirm. |
| Cabernet | sulphites | — | wine, cabernet sauvignon grape | [Cabernet Sauvignon](https://en.wikipedia.org/wiki/Cabernet_Sauvignon) | medium | Assumed Cabernet Sauvignon: venue to confirm grape (Sauvignon or Franc), origin and producer. |
| Venato (Italy) | sulphites | — | wine, wine grape | [Italian wine](https://en.wikipedia.org/wiki/Italian_wine) | low | 'Venato' not found as an Italian wine (perhaps the Veneto region): venue to confirm the wine, colour and grape. |
| Borsao (Spain) | sulphites | — | wine, garnacha grape | [Campo de Borja (DO)](https://en.wikipedia.org/wiki/Campo_de_Borja_(DO)) | low | Which Borsao wine to confirm (mostly Garnacha reds; also rosé and white). |
| Bordeaux (France) | sulphites | — | wine, merlot grape, cabernet sauvignon grape | [Bordeaux wine](https://en.wikipedia.org/wiki/Bordeaux_wine) | medium | Assumed red (most Bordeaux is): venue to confirm the château and blend. |
| Pinot Noir (France) | sulphites | — | wine, pinot noir grape | [Pinot noir](https://en.wikipedia.org/wiki/Pinot_noir) | medium | Producer and region not named: venue to confirm. |
| Raki | — | — | grape, anise, water | [Rakı](https://en.wikipedia.org/wiki/Rakı) | medium | Brand and the serving size for 19.99 not named: venue to confirm; distilled grape spirit, no sulphites expected. |
| Aragh Sagi | sulphites | — | raisin | [Aragh Sagi](https://en.wikipedia.org/wiki/Aragh_Sagi) | medium | Raisins are often sulphited when dried; drafted because the description names raisins (a distilled spirit may carry little or none): Kian to keep or remove. Brand not named; distilled from raisins, sulphites not expected after distillation: bottle label to confirm. |
| Pinot Grigio | sulphites | — | wine, pinot gris grape | [Pinot gris](https://en.wikipedia.org/wiki/Pinot_gris) | medium | Producer not named: venue to confirm. |
| Sauvignon Blanc | sulphites | — | wine, sauvignon blanc grape | [Sauvignon blanc](https://en.wikipedia.org/wiki/Sauvignon_blanc) | medium | Producer and origin not named: venue to confirm. |
| Chardonnay | sulphites | — | wine, chardonnay grape | [Chardonnay](https://en.wikipedia.org/wiki/Chardonnay) | medium | Producer not named; oaked or unoaked to confirm. |
| Shiraz | sulphites | — | wine, shiraz grape | [Syrah](https://en.wikipedia.org/wiki/Syrah) | medium | Producer and origin not named (style varies with climate): venue to confirm. |
| Cab Sauv | sulphites | — | wine, cabernet sauvignon grape | [Cabernet Sauvignon](https://en.wikipedia.org/wiki/Cabernet_Sauvignon) | medium | Producer and origin not named: venue to confirm. |
| Merlot | sulphites | — | wine, merlot grape | [Merlot](https://en.wikipedia.org/wiki/Merlot) | medium | Producer and origin not named: venue to confirm. |
| Rose | sulphites | — | wine, red grape | [Rosé](https://en.wikipedia.org/wiki/Rosé) | medium | Producer, grapes and sweetness not named: venue to confirm. |
| Prosecco | sulphites | — | sparkling wine, glera grape | [Prosecco](https://en.wikipedia.org/wiki/Prosecco) | high | Producer not named. |

## New descriptions (English and Persian drafts)

| Item | English | Persian |
| --- | --- | --- |
| Green Salad | Crisp lettuce, cucumber and tomato; a fresh, cool side to balance anything from the grill. | کاهوی ترد با خیار و گوجه‌فرنگی؛ سالادی تازه و خنک کنار کباب. |
| Yogurt with Shallot Dip (Maast o Moosir) | Thick, creamy yogurt with chopped Persian shallot (moosir); cool and tangy with a mild bite, the classic partner for kebab. | ماست غلیظ با موسیر خردشده؛ خنک و خوش‌طعم، همراه همیشگی کباب. |
| Baba Ghanoosh | Smoky roasted eggplant blended with tahini, garlic, lemon and olive oil; silky, rich and made for scooping. | بادمجان کبابی دودی با ارده، سیر، آبلیمو و روغن زیتون؛ نرم و لطیف. |
| Fried Eggplant | Eggplant slices fried until golden outside and silky within; a simple, home-style Persian appetizer. | برش‌های بادمجان سرخ‌شده، طلایی و نرم؛ پیش‌غذایی ساده و خانگی. |
| Local Yogurt Moosir | Country-style yogurt with Persian shallot (moosir); tangy, cool and made for kebab. | ماست محلی با موسیر؛ ترش و خنک، همراهی دلچسب برای کباب. |
| Baklava | Layers of flaky, buttery pastry filled with chopped nuts and soaked in fragrant syrup. | لایه‌های نازک و ترد خمیر با کره، پر از مغزهای خردشده و آغشته به شربت معطر. |
| Tiramisu cake | Coffee-soaked sponge layered with mascarpone cream, finished with a dusting of cocoa. | کیک اسفنجی خیس‌خورده در قهوه با لایه‌های کرم ماسکارپونه و پودر کاکائو. |
| Pistachio cake | Soft cake made with pistachios; nutty, gently sweet and a lovely end to the meal. | کیک نرم با پسته؛ مغزدار و با شیرینی ملایم، پایانی دلچسب برای غذا. |
| Nutella cake | Soft cake with Nutella, the hazelnut and cocoa spread; rich, sweet and indulgent. | کیک نرم با نوتلا، کرم فندق و کاکائو؛ شیرین و دلچسب. |
| Caramel and hazelnut cake | Soft cake with caramel and hazelnuts; sweet, nutty and buttery. | کیک نرم با کارامل و فندق؛ شیرین، مغزدار و خوش‌طعم. |
| Baileys Shot | A shot of Baileys Irish Cream: cream, cocoa and Irish whiskey in one sweet, silky sip. | یک پیک بیلیز، لیکور خامه‌ای ایرلندی از خامه، کاکائو و ویسکی؛ شیرین و مخملی. |
| Gin & Tonic | A bar classic: gin and tonic water over ice with a wedge of lime; crisp, bittersweet and bubbly. | کلاسیک بار: جین و آب تونیک روی یخ با یک برش لیمو؛ خنک، گازدار و کمی تلخ. |
| Jägermeister | German herbal liqueur of 56 herbs, fruits, roots and spices, among them citrus peel, liquorice, anise, ginger and saffron: sweet and spiced. | لیکور گیاهی آلمانی از 56 گیاه، میوه، ریشه و ادویه، از جمله پوست مرکبات، شیرین‌بیان، انیسون، زنجبیل و زعفران؛ شیرین و پرادویه. |
| Ketel One | Dutch vodka from the Nolet distillery in Schiedam, distilled from wheat in copper pot stills: crisp and clean, by the shot or bottle. | ودکای هلندی خاندان نولت از سخیدام، که از گندم و در دیگ‌های مسی تقطیر می‌شود؛ صاف و خالص. پیکی یا بطری. |
| Grey Goose | French vodka from Picardy winter wheat, blended in Cognac with limestone spring water: soft and clean, by the shot or bottle. | ودکای فرانسوی از گندم زمستانه‌ی پیکاردی، آمیخته با آب چشمه در کنیاک؛ نرم و خالص. پیکی یا بطری. |
| Ciroc Peach | French vodka distilled from grapes and flavoured with peach: soft, fruity and fragrant, by the shot or bottle. | ودکای فرانسوی تقطیرشده از انگور، با طعم هلو؛ نرم، میوه‌ای و خوش‌عطر. پیکی یا بطری. |
| Crown Royal | Blended Canadian whisky from Gimli, Manitoba, made from rye, corn and barley: smooth and mellow, by the shot or bottle. | ویسکی کانادایی از گیملی در مانیتوبا، ترکیبی از چاودار، ذرت و جو؛ نرم و ملایم. پیکی یا بطری. |
| Jameson | Blended Irish whiskey from Midleton, County Cork, made with malted and unmalted Irish barley: smooth and easy-going, by the shot or bottle. | ویسکی ایرلندی از میدلتون در کانتی کورک، با جو ایرلندی مالت‌شده و مالت‌نشده؛ نرم و خوش‌نوش. پیکی یا بطری. |
| Black Label | Johnnie Walker's blended Scotch whisky, aged 12 years: rich, rounded and gently smoky, by the shot or bottle. | اسکاچ ترکیبی 12 ساله‌ی جانی واکر؛ پرمایه، گرم و کمی دودی. پیکی یا بطری. |
| Glenfiddich 12 | Speyside single malt Scotch from Dufftown, aged 12 years in American and European oak casks: fresh, fruity and mellow, by the shot or bottle. | تک‌مالت اسکاچ از اسپی‌ساید، ساخت داف‌تاون، با 12 سال کهنگی در بشکه‌های بلوط آمریکایی و اروپایی؛ تازه، میوه‌ای و ملایم. پیکی یا بطری. |
| Merlot (France) | A soft, round, fruity French red with velvety tannins; easy with anything off the charcoal grill. | شراب قرمز فرانسوی، نرم و میوه‌ای با تانن‌های مخملی؛ کنار هر کبابی از روی زغال خوش می‌نشیند. |
| Shiraz (Australia) | Australian Shiraz: a full-bodied, jammy red with soft tannins and a spicy finish, made for charcoal-grilled kebabs. | شیراز استرالیایی؛ شراب قرمز پرقوام و مربایی با تانن نرم و ته‌مزه‌ای گرم و تند، همراه خوب کباب زغالی. |
| Cabernet | A full-bodied red with firm tannins and fresh acidity; a sturdy partner for charcoal-grilled kebabs. | شراب قرمز پرقوام با تانن محکم و ترشی دلپذیر؛ کنار کباب‌های زغالی خوب جا می‌افتد. |
| Borsao (Spain) | Spanish wine from Bodegas Borsao in Campo de Borja, Aragón, home of old-vine Garnacha; ask your server which bottle. | شراب اسپانیایی از بودگاس بورسائو در کامپو د بورخا، آراگون، سرزمین تاکستان‌های کهن گارناچا؛ نوعش را از گارسون بپرسید. |
| Bordeaux (France) | A French red from Bordeaux, usually a blend of Merlot and Cabernet Sauvignon: dry, structured and made for the grill. | شراب قرمز فرانسوی از بوردو، معمولاً ترکیبی از مرلو و کابرنه سوینیون؛ خشک و خوش‌ساختار، برای سفره‌ی کباب. |
| Pinot Noir (France) | French Pinot Noir, the red grape of Burgundy: light to medium-bodied, silky and fragrant, with gentle tannins. | پینو نوآر فرانسوی، انگور قرمز بورگونی؛ سبک تا متوسط، لطیف و خوش‌عطر با تانن ملایم. |
| Raki | Turkish anise spirit distilled from grapes; with cold water it turns cloudy white. A classic beside grilled kebabs. | عرق انیسون ترکیه‌ای از تقطیر انگور؛ با آب سرد سفید و کدر می‌شود. همراه کلاسیک کباب. |
| Aragh Sagi | Iran's traditional spirit, distilled from fermented raisins: clear, strong and aromatic, for sipping slowly beside your kebab. | عرق کشمش به رسم قدیم ایرانی؛ زلال، تند و خوش‌عطر، برای جرعه‌جرعه نوشیدن کنار کباب. |
| Pinot Grigio | A light, crisp and dry white in the Italian style, with refreshing acidity and a clean finish. | شراب سفید سبک و خشک به شیوه‌ی ایتالیایی؛ ترش‌مزه، تازه و خوش‌نوش. |
| Sauvignon Blanc | A crisp, dry, zesty white with lively acidity and grassy to tropical notes; refreshing between bites of kebab. | شراب سفید خشک و ترش‌مزه با عطری علفی و استوایی؛ میان لقمه‌های کباب، خنک و دلچسب. |
| Chardonnay | A medium-bodied white with a round, soft texture: fresh, fruity and easy alongside grilled kebabs. | شراب سفید با بدنه‌ی متوسط و بافتی نرم و لطیف؛ تازه، میوه‌ای و خوش‌نوش کنار کباب. |
| Shiraz | A full-bodied, jammy red with soft tannins and a spicy finish; a natural match for charcoal-grilled kebabs. | شراب قرمز پرقوام و مربایی با تانن نرم و ته‌مزه‌ای گرم و تند؛ کنار کباب زغالی خوب می‌نشیند. |
| Cab Sauv | A full-bodied red with firm tannins, fresh acidity and dark-fruited depth; stands up well to charcoal-grilled kebabs. | شراب قرمز پرقوام با تانن محکم، ترشی دلپذیر و عمقی میوه‌ای؛ پابه‌پای کباب زغالی. |
| Merlot | A soft, round and fruity red with velvety tannins; easy-drinking with any kebab from the grill. | شراب قرمز نرم و میوه‌ای با تانن‌های مخملی؛ خوش‌نوش کنار هر کبابی. |
| Rose | Pink wine from red grapes, served chilled: fresh, fruity and light, easy alongside anything from the grill. | شراب صورتی از انگور قرمز که خنک سرو می‌شود؛ تازه، سبک و میوه‌ای، کنار هر چیزی از روی منقل. |
| Prosecco | Italian sparkling wine from the Glera grape of Veneto and Friuli: light, fresh and bubbly, a bright start to the meal. | شراب گازدار ایتالیایی از انگور گلرا، از ونتو و فریولی؛ سبک، تازه و پرحباب، شروعی دلپذیر برای سفره. |

## The general allergy notice (every venue, from 2026-10-12)

- English: Please tell your server about any allergies before ordering. Our dishes may contain or come into contact with common allergens.
- Persian (draft for Kian): لطفاً پیش از سفارش، هرگونه حساسیت غذایی را به همکاران ما اطلاع دهید. غذاهای ما ممکن است حاوی مواد حساسیت‌زای رایج باشند یا با آن‌ها در تماس قرار بگیرند.
