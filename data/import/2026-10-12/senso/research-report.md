# Menu research — Senso Café & Bites (2026-10-12)

Record: `research.json` beside this file (140 items: every item shown on the venue's page on 2026-10-12). Applied by `tools/import/research-apply.mjs` (also step 7 of `npm run setup`), reviewed in `reports/research-review-senso.csv` and read back by `tools/import/research-review-apply.mjs`. Written by the research, recorded as "Research".

## Rules followed (Kian via the PM, 2026-10-12)

- Names, prices, sections and every existing text are never changed. A description is written only where the field is empty: English and Persian; where one language existed, the other is written from it (same ingredients, nothing added).
- Style: 1–2 short lines, at most 25 English words: the key ingredients and why the item is worth ordering, not a recipe. Voice: a warm daytime café. Persian written as a Persian menu reads, not a literal translation; Western digits.
- No superlatives about the venue or the dish, no health, medical or nutrition claims, even where the item's name implies one (the names are the venue's decision, ruling 11, and stay as they are). The word lists: `tools/import/research-lexicon.mjs` (`CLAIM_WORDS`, `SUPERLATIVES`).
- Every ingredient a description names (the existing ones included) is in the item's key ingredients, and its allergen is in the allergen draft (checked by `scripts/research-drill.mjs` with the lexicon in `tools/import/research-lexicon.mjs`).
- Allergens, "contains" only, never "free-from": Health Canada's priority food allergens plus the other gluten sources, these words only: milk (شیر), egg (تخم‌مرغ), wheat (گندم), barley (جو), oats (جو دوسر), rye (چاودار), tree nuts (مغزهای درختی), peanuts (بادام‌زمینی), sesame (کنجد), soy (سویا), mustard (خردل), fish (ماهی), crustaceans (سخت‌پوستان), molluscs (نرم‌تنان), sulphites (سولفیت). Optional add-ons are the customer's choice: their allergens are in the item's note, not in its allergens. A distilled spirit does not get the grain it is made from.
- Dietary: Vegetarian or Vegan only, as drafts; empty when unsure (wine, beer and spirits included, which may be fined with animal products). Never gluten-free, dairy-free or nut-free; halal never set.
- Basis per item: the assumed key ingredients and one source URL for the dish or drink type (Wikipedia where it has an article; every URL answered 200 when it was recorded).
- Customers: the new descriptions are shown (marked as drafts in the admin: English "Draft", Persian "Persian draft"); the allergen and dietary drafts are not in the public HTML until an owner or admin confirms them (Confirm in the item editor, or "yes" in the review sheet).

## Counts

| | Items |
| --- | --- |
| In the record (shown items) | 140 |
| New English descriptions | 95 |
| New Persian descriptions (Persian drafts) | 94 |
| With at least one allergen in the draft | 98 |
| No priority allergen found in the typical recipe | 42 |
| Dietary draft Vegetarian / Vegan / none | 71 / 31 / 38 |
| Confidence high / medium / low | 61 / 66 / 13 |

Allergens across the drafts: milk 87, egg 38, wheat 57, barley 2, tree nuts 22, peanuts 1, sesame 6, soy 4, mustard 1, fish 1.

## Existing descriptions that contradict the research (flagged, not fixed)

| Item | Why |
| --- | --- |
| Majoun | Owner's notes say Vegan and list only "NUTS", but the description has ice cream, cream and honey (not vegan) and names peanut, sesame and dairy; note text "Hi this is a note" looks like a test entry. |
| Del Roba | English 'To lemon' is به‌لیمو, lemon verbena (not lemon), and English 'saffron plant' is نبات زعفرانی, saffron rock candy, in the Persian; 'assochodos' is lavender |
| Digestive Herbal Tea | English 'lemon' is به‌لیمو (lemon verbena) and English 'rose' is گلاب (rose water) in the Persian, which also has rosebuds (غنچه گل محمدی) where the English says 'mohamady flower' |
| Power Herbal Tea | English 'saffron plant' is نبات زعفرانی, saffron rock candy, in the Persian |
| Women's Life Herbal Tea | English 'lemon' is به‌لیمو (lemon verbena) in the Persian |
| Sausage & Egg | The name says sausage (سوسیس); both descriptions say "slice of beef" / برش گوشت گاو and name no sausage. |
| Sausage, Egg & Tomato | The name says sausage (سوسیس); both descriptions say "slice of beef" / برش گوشت گاو and name no sausage. |
| Gheymagh | The English lists clotted cream, cream, honey, feta cheese and bread; the Persian (سرشير خامه عسل) names only clotted cream, cream and honey. |
| Mama pizza (Grilled chicken Salami,beef bacon) | The name lists salami; both descriptions list diced beef instead and no salami. |

## Changes the build agent made to the research drafts (before the record was written)

- Falooda: the noodles are starch noodles (the text said "noodles", which reads as wheat pasta); wheat kept as a precaution until the kitchen confirms the starch
- Ice cream & Falooda: as Falooda
- Greek Salad: a draft must not miss an allergen the typical recipe carries; the owner removes it if the kitchen serves it without feta

## For the venue to confirm (low confidence)

| Item | What the venue must confirm |
| --- | --- |
| Pomegranate majoun | Recipe not public: venue to confirm pomegranate seeds or juice, which ice cream, and any cream, nuts, dates or honey. |
| Green Mojito | recipe not public: venue to confirm alcohol-free (assumed from the Fresh Juice section), soda or blended, and what makes it green |
| Baklava Cake | Recipe not public: venue to confirm the cake (which nuts, syrup or honey, any filo, butter). |
| Chocolate Late Cake | English name "Late" is unclear (lava, layer or latte?); the Persian name says only کیک شکلاتی; venue to confirm. |
| Brain & Tongue Omelette | Recipe not public: venue to confirm the animal (lamb or beef), the cooking fat (butter adds milk) and the sides (bread, cheese). |
| Papa Egg (Roast beef) | House recipe not public: venue to confirm how the eggs are cooked and the sides (bread, cheese, herbs as on the other breakfasts). |
| Senso Waffle | House recipe not public: venue to confirm the toppings and their allergens; only a standard waffle batter is assumed. |
| chips o panir | Venue to confirm the cheese and any toppings (mushroom, sausage, sauce), often added in Iran. |
| Sosis Plate | Plate contents not public: venue to confirm the sausage and the sides (bread, fries, pickles, tomato). |
| Smoked Montreal Roast Beef Sandwich | Recipe not public: venue to confirm the bread, sauces and toppings (mustard, cheese, pickles). |
| Smoked Turkey Breast Sandwich | Recipe not public: venue to confirm the bread, sauces and toppings. |
| Smoked Chicken Breast Sandwich | Recipe not public: venue to confirm the bread, sauces and toppings. |
| Ginger shot | Recipe not public: venue to confirm what else is in it (lemon, apple, honey, turmeric). |

## Items whose names carry a health claim (names kept; descriptions describe taste and ingredients only)

- Allergy Herbal Tea: "A herbal blend of borage flower, orange blossom, thyme, mint, cinnamon, valerian, lemon verbena, ginger, saffron rock candy and rose water."
- Digestive Herbal Tea (its own description kept)
- Power Herbal Tea (its own description kept)
- Relaxing Herbal Tea (its own description kept)
- Stressless Herbal Tea (its own description kept)
- Women's Life Herbal Tea (its own description kept)
- Cancer Killer (its own description kept)
- Ginger shot: "A small, fiery shot of fresh ginger."

## Every item: draft and basis

| Item | Allergens (draft) | Dietary (draft) | Key ingredients | Source | Confidence | Note |
| --- | --- | --- | --- | --- | --- | --- |
| Pumpkin Soup | milk | — | pumpkin, cream, autumn spices, onion, broth | [Pumpkin soup](https://en.wikipedia.org/wiki/Pumpkin_soup) | medium | Kitchen to confirm the broth (chicken or vegetable) and which spices. |
| Senso Pumpkin Omelette | egg, sesame, tree nuts | Vegetarian | pumpkin, egg, date syrup, tahini, walnut, pistachio | [Omelette](https://en.wikipedia.org/wiki/Omelette) | high | Kitchen to confirm the cooking fat (butter adds milk) and any bread served. |
| Pumpkin Cheesecake | milk, egg, wheat | Vegetarian | pumpkin, cream cheese, sugar, egg, graham cracker crust, butter, cinnamon, nutmeg, ginger, clove | [Cheesecake](https://en.wikipedia.org/wiki/Cheesecake) | medium | Kitchen to confirm: biscuit crust (wheat) and eggs (a baked cheesecake assumed). |
| Warm Pumpkin & Ice Cream | milk, sesame, tree nuts | Vegetarian | pumpkin, vanilla ice cream, milk, cream, sugar, vanilla, date syrup, tahini, walnut, pistachio, coconut, sesame seed | [Kabak tatlısı](https://en.wikipedia.org/wiki/Kabak_tatl%C4%B1s%C4%B1) | high | Kitchen to confirm: egg in the vanilla ice cream (custard-style bases contain it). |
| Pumpkin Cake | wheat, egg | Vegetarian | pumpkin, wheat flour, sugar, egg, vegetable oil, baking soda, cinnamon, nutmeg, ginger, clove | [Pumpkin bread](https://en.wikipedia.org/wiki/Pumpkin_bread) | medium | Kitchen to confirm: butter or a cream-cheese frosting (milk); pumpkin bread recipes typically use oil. |
| Pumpkin Latte | milk | Vegetarian | espresso, milk, pumpkin syrup, autumn spices (cinnamon, nutmeg, clove) | [Pumpkin spice latte](https://en.wikipedia.org/wiki/Pumpkin_spice_latte) | medium | kitchen to confirm the pumpkin syrup's ingredients and any whipped cream topping |
| Carrot Juice with Ice cream | milk, egg, tree nuts | Vegetarian | carrot juice, carrot, ice cream, milk, cream, sugar, egg yolk, saffron, rose water, pistachio | [Bastani](https://en.wikipedia.org/wiki/Bastani) | medium | Kitchen to confirm the ice cream: Persian saffron bastani (egg yolk, pistachio) assumed, as in āb havīj bastani. |
| Majoun | milk, egg, tree nuts, peanuts, sesame | Vegetarian | traditional persian ice cream, ice cream, milk, sugar, egg yolk, saffron, rose water, cream, almond, pistachio, peanut, hazelnut, walnut, date, fig, date molasses, honey, sesame | [Majoon - Date Ice Cream Shake with Nuts معجون - Labsalliebe](https://labsalliebe.com/en/majoon-date-ice-cream-shake-with-nuts-%D9%85%D8%B9%D8%AC%D9%88%D9%86/) | high | Persian ice cream contains egg yolk (Wikipedia: Bastani); kitchen to confirm sulphites if the figs are sulphured dried figs. |
| Ice cream & Falooda | milk, egg, tree nuts, wheat | Vegetarian | starch noodle, sugar, rose water, lime juice, persian ice cream, milk, cream, egg yolk, saffron, pistachio | [Faloodeh](https://en.wikipedia.org/wiki/Faloodeh) | medium | Kitchen to confirm: noodle starch (wheat starch is common in Iran) and the ice cream (saffron bastani: egg, pistachio). Wheat drafted because faloodeh noodles are made from starch and wheat starch is common in Iran (some use corn starch): kitchen to confirm the starch. |
| Banana & Pistachio Milk | milk, tree nuts | Vegetarian | banana, milk, pistachio, sugar | [Milkshake](https://en.wikipedia.org/wiki/Milkshake) | medium | Kitchen to confirm: ice cream, sugar or honey in the blend, and pistachio as nuts, paste or syrup. |
| Pomegranate majoun | milk | — | pomegranate, ice cream, milk, sugar | [Majoon - Date Ice Cream Shake with Nuts معجون - Labsalliebe](https://labsalliebe.com/en/majoon-date-ice-cream-shake-with-nuts-%D9%85%D8%B9%D8%AC%D9%88%D9%86/) | low | Recipe not public: venue to confirm pomegranate seeds or juice, which ice cream, and any cream, nuts, dates or honey. |
| Turkish Coffee | — | Vegan | coffee, water | [Turkish coffee](https://en.wikipedia.org/wiki/Turkish_coffee) | high | sugar to taste and cardamom are common in Turkish coffee: venue to confirm if either is added |
| Brewing Coffee | — | Vegan | coffee, water | [Drip coffee](https://en.wikipedia.org/wiki/Drip_coffee) | high | options: lactose-free milk (milk), milk (milk), cream (milk), almond milk (tree nuts), oat milk (oats) |
| Espresso | — | Vegan | coffee, water | [Espresso](https://en.wikipedia.org/wiki/Espresso) | high |  |
| Americano | — | Vegan | espresso, water | [Caffè americano](https://en.wikipedia.org/wiki/Caff%C3%A8_americano) | high |  |
| Latte | milk | Vegetarian | espresso, milk | [Latte](https://en.wikipedia.org/wiki/Latte) | high | options: vanilla syrup, hazelnut syrup (flavouring; check the syrup brand for tree nuts) |
| Organic Beet Latte | milk | Vegetarian | organic beetroot powder, milk | [Pink Latte (Hot or Iced) Recipe \| Gimme Some Oven](https://www.gimmesomeoven.com/beetroot-pink-latte-recipe/) | medium | venue to confirm: coffee-free or with espresso, any spices (cardamom, cinnamon, ginger are common) or sweetener, and the default milk |
| Cappuccino | milk | Vegetarian | espresso, milk | [Cappuccino](https://en.wikipedia.org/wiki/Cappuccino) | high | a cocoa or cinnamon dusting is common: venue to confirm |
| Mocha | milk | Vegetarian | espresso, chocolate sauce, milk | [Caffè mocha](https://en.wikipedia.org/wiki/Caff%C3%A8_mocha) | medium | kitchen to confirm the chocolate (sauce or cocoa; some contain soy lecithin) and any whipped cream |
| Caramel Macchiato | milk | Vegetarian | milk, espresso, vanilla syrup, caramel sauce | [Caramel macchiato recipe \| Good Food](https://www.bbcgoodfood.com/recipes/caramel-macchiato) | medium | kitchen to confirm vanilla syrup or extract and the caramel sauce's ingredients |
| Affogato | milk | Vegetarian | vanilla ice cream, espresso | [Affogato](https://en.wikipedia.org/wiki/Affogato) | medium | kitchen to confirm: ice cream flavour (vanilla assumed), egg in the ice cream, and no gelatine |
| Hot chocolate | milk | Vegetarian | chocolate, milk, sugar | [Hot chocolate](https://en.wikipedia.org/wiki/Hot_chocolate) | medium | kitchen to confirm the chocolate (some contain soy lecithin) and toppings (marshmallows usually contain gelatine) |
| Matcha Latte | milk | Vegetarian | matcha, milk | [Matcha latte](https://en.wikipedia.org/wiki/Matcha_latte) | medium | venue to confirm any sweetener and the default milk |
| Tea | — | Vegan | black tea, water | [Black tea](https://en.wikipedia.org/wiki/Black_tea) | medium | venue to confirm: black tea, any cardamom, and what is served with it (sugar cubes, rock candy) |
| Large Tea | — | Vegan | black tea, water | [Black tea](https://en.wikipedia.org/wiki/Black_tea) | medium | venue to confirm: a large cup or a pot, black tea, any cardamom |
| Borage with lime | — | Vegan | persian borage flower, dried lime | [Echium amoenum](https://en.wikipedia.org/wiki/Echium_amoenum) | medium | the English name says 'lime', the Persian name لیمو عمانی (dried lime): venue to confirm, and any sweetener (rock candy is common) |
| Allergy Herbal Tea | — | Vegan | persian borage flower, orange blossom, thyme, mint, cinnamon, valerian, lemon verbena, ginger, saffron rock candy, rose water | [Herbal tea](https://en.wikipedia.org/wiki/Herbal_tea) | high | English written from the Persian list; the Persian spells valerian سنبل الطیف (سنبل‌الطیب); both names carry a health claim, the Persian a stray ')' (flagged) |
| Apple & Cinnamon Herbal Tea | — | Vegan | apple, cinnamon | [Herbal tea](https://en.wikipedia.org/wiki/Herbal_tea) | medium | venue to confirm fresh or dried apple (dried apple may be sulphited), and any other herbs or sweetener |
| Del Roba | — | Vegan | lemon verbena, orange blossom, damask rose (gol mohammadi), persian borage flower, lavender, saffron rock candy | [Herbal tea](https://en.wikipedia.org/wiki/Herbal_tea) | high | spelling only: the Persian writes lavender اسوخودوس (اسطوخودوس); 'spring orange' = orange blossom, 'mohamady flower' = damask rose |
| Green tea | — | Vegan | green tea, water | [Green tea](https://en.wikipedia.org/wiki/Green_tea) | high | venue to confirm loose leaf or bag, cup or pot |
| Digestive Herbal Tea | — | Vegan | orange blossom, mint, damask rosebud (gol mohammadi), persian borage flower, lemon verbena, cinnamon, rose water, fresh lemon juice | [Herbal tea](https://en.wikipedia.org/wiki/Herbal_tea) | high | the English name is a health claim (flagged); the Persian name دمنوش عشاق ('lovers' herbal tea') differs from it |
| Naz Bano Herbal Tea | — | Vegan | persian borage flower, chamomile flower, valerian, cinnamon | [Herbal tea](https://en.wikipedia.org/wiki/Herbal_tea) | high | spelling only: 'valerine' and سنبل الطیف are valerian (سنبل‌الطیب) |
| Power Herbal Tea | — | Vegan | mint, chamomile, persian borage flower, black tea, valerian, lavender, ginger, saffron rock candy | [Herbal tea](https://en.wikipedia.org/wiki/Herbal_tea) | high | spelling: 'valerine' = valerian, اسوخودوس = اسطوخودوس (lavender); the Persian name دمنوش دل خواه differs; the English name is a claim (flagged) |
| Relaxing Herbal Tea | — | Vegan | hibiscus (sour tea), persian borage flower, cinnamon | [Hibiscus tea](https://en.wikipedia.org/wiki/Hibiscus_tea) | high | 'sour tea' (چای ترش) is hibiscus (roselle); the Persian name دمنوش زن differs from the English; the English name is a claim (flagged) |
| Saffron Herbal Tea | — | Vegan | saffron, water | [Saffron](https://en.wikipedia.org/wiki/Saffron) | medium | venue to confirm what else is in it (rock candy, cardamom, rose or green tea are common in Persian saffron tea) |
| Stressless Herbal Tea | — | Vegan | chamomile, valerian, black tea, ginger | [Herbal tea](https://en.wikipedia.org/wiki/Herbal_tea) | high | spelling: 'Valerine' and سنبل الطیف are valerian; the Persian name دمنوش افسون differs; the English name is a claim (flagged) |
| Women's Life Herbal Tea | — | Vegetarian | chamomile flower, lemon verbena, damask rose (gol mohammadi), ginger, mint, thyme, cardamom, honey | [Herbal tea](https://en.wikipedia.org/wiki/Herbal_tea) | high | honey makes it Vegetarian, not Vegan; the English name is a claim (flagged) |
| Ice pistachio latte | milk, tree nuts | Vegetarian | espresso, milk, pistachio, ice | [Iced coffee](https://en.wikipedia.org/wiki/Iced_coffee) | medium | kitchen to confirm: pistachio paste or a pistachio-flavoured syrup (tree nuts kept), sweetener and any topping |
| Ice saffron latte | milk | Vegetarian | espresso, milk, saffron, ice | [Iced coffee](https://en.wikipedia.org/wiki/Iced_coffee) | medium | venue to confirm espresso (some saffron lattes have none), the sweetener (saffron syrup, rock candy) and any garnish |
| Iced Latte | milk | Vegetarian | espresso, milk, ice | [Iced coffee](https://en.wikipedia.org/wiki/Iced_coffee) | high |  |
| Iced Americano | — | Vegan | espresso, water, ice | [Caffè americano](https://en.wikipedia.org/wiki/Caff%C3%A8_americano) | high |  |
| Iced Matcha Latte | milk | Vegetarian | matcha, milk, ice | [Matcha latte](https://en.wikipedia.org/wiki/Matcha_latte) | medium | venue to confirm any sweetener and the default milk |
| Green Mojito | — | — | mint, lime, sugar, soda water, ice | [Mojito](https://en.wikipedia.org/wiki/Mojito) | low | recipe not public: venue to confirm alcohol-free (assumed from the Fresh Juice section), soda or blended, and what makes it green |
| Cantaloupe | — | Vegan | cantaloupe | [Juice](https://en.wikipedia.org/wiki/Juice) | medium | venue to confirm whether ice, sugar or milk is added |
| Orange | — | Vegan | orange | [Orange juice](https://en.wikipedia.org/wiki/Orange_juice) | high |  |
| Mango | — | Vegan | mango | [Juice](https://en.wikipedia.org/wiki/Juice) | medium | venue to confirm fresh mango or mango pulp, and any water, ice or sugar |
| Watermelon | — | Vegan | watermelon | [Juice](https://en.wikipedia.org/wiki/Juice) | high | the Persian name is spelled اب هندوانه (آب هندوانه); spelling only |
| Cancer Killer | — | Vegan | beetroot, celery, ginger, carrot, green apple, lime, pomegranate, kiwi | [Vegetable juice](https://en.wikipedia.org/wiki/Vegetable_juice) | high | the name is a health claim (venue's decision under ruling 11; flagged) |
| Carrot Juice | — | Vegan | carrot | [Carrot juice](https://en.wikipedia.org/wiki/Carrot_juice) | high |  |
| Celery Juice | — | Vegan | celery | [Celery](https://en.wikipedia.org/wiki/Celery) | high | venue to confirm whether apple or lemon is added |
| Almond Croissant | wheat, milk, egg, tree nuts | Vegetarian | croissant, wheat flour, butter, yeast, milk, sugar, egg, almond cream, almond, powdered sugar | [Croissant](https://en.wikipedia.org/wiki/Croissant) | high | Kitchen to confirm: egg wash. Existing English ends with "..", the Persian text spells کرواسـان with a kashida. |
| Caramel Tres Leches | wheat, egg, milk | Vegetarian | sponge cake, wheat flour, egg, sugar, evaporated milk, condensed milk, milk, whipped cream, caramel sauce, butter | [Tres leches cake](https://en.wikipedia.org/wiki/Tres_leches_cake) | medium | Caramel-topped trileçe style assumed (Wikipedia: Tres leches cake); kitchen to confirm the topping. |
| Dubai Chocolate Cheesecake | milk, wheat, tree nuts, sesame | — | cream cheese, sugar, cream, biscuit crust, butter, milk chocolate, pistachio cream, pistachio, tahini, kataifi pastry | [Dubai chocolate](https://en.wikipedia.org/wiki/Dubai_chocolate) | medium | Kitchen to confirm: tahini (sesame) in the pistachio cream, egg (baked or no-bake), soy in the chocolate, no gelatine. |
| Nutella Oreo Cheesecake | milk, tree nuts, wheat, soy | — | cream cheese, sugar, cream, nutella, hazelnut, cocoa, oreo cookie, wheat flour, soy lecithin, butter | [Cheesecake](https://en.wikipedia.org/wiki/Cheesecake) | medium | Nutella and Oreo both contain soy lecithin; kitchen to confirm egg (baked or no-bake) and no gelatine. |
| Persian Pistachio Croissant | wheat, milk, egg, tree nuts | Vegetarian | croissant, wheat flour, butter, yeast, milk, sugar, egg, pistachio cream, pistachio | [Croissant](https://en.wikipedia.org/wiki/Croissant) | high | Kitchen to confirm: egg wash. Existing English uses "perfectly" (a superlative) and ends with a stray invisible mark. |
| Pistachio Cake | wheat, tree nuts, milk, egg | Vegetarian | wheat flour, pistachio, butter, sugar, egg, milk, baking powder | [Pistachio Cake (Deliciously Moist!) - Sally's Baking](https://sallysbakingaddiction.com/pistachio-cake/) | medium | Kitchen to confirm: frosting or topping (cream, white chocolate) and any other nuts. |
| Pistachio Cheesecake | milk, egg, tree nuts, wheat | — | cream cheese, sugar, egg, cream, pistachio, biscuit crust, butter | [Cheesecake](https://en.wikipedia.org/wiki/Cheesecake) | medium | Kitchen to confirm: baked (egg) or no-bake (gelatine possible), and the crust (wheat). |
| Small Baklava | wheat, milk, tree nuts | Vegetarian | filo pastry, butter, walnut, pistachio, sugar syrup | [Baklava](https://en.wikipedia.org/wiki/Baklava) | medium | Kitchen to confirm: the nuts (pistachio, walnut or almond), butter or oil, syrup or honey. |
| Large Baklava | wheat, milk, tree nuts | Vegetarian | filo pastry, butter, walnut, pistachio, sugar syrup | [Baklava](https://en.wikipedia.org/wiki/Baklava) | medium | Kitchen to confirm: the nuts (pistachio, walnut or almond), butter or oil, syrup or honey, and the portion size. |
| Butter Croissant | wheat, milk, egg | Vegetarian | croissant, wheat flour, butter, yeast, milk, sugar, egg, salt | [Croissant](https://en.wikipedia.org/wiki/Croissant) | high | Kitchen to confirm: egg wash. |
| Tiramisu | wheat, egg, milk | Vegetarian | vanilla sponge cake, wheat flour, egg, sugar, vanilla, coffee, mascarpone, cocoa powder | [Tiramisu](https://en.wikipedia.org/wiki/Tiramisu) | high | Classic tiramisu uses ladyfingers and egg-yolk cream; kitchen to confirm egg in the cream and any Marsala or liqueur. |
| Turkish Knafeh | wheat, milk, tree nuts | Vegetarian | kadayif pastry, wheat flour, unsalted cheese, butter, sugar syrup, pistachio | [Knafeh](https://en.wikipedia.org/wiki/Knafeh) | high | Kitchen to confirm: the cheese and butter or ghee. |
| Lotus cheesecake | milk, wheat, soy | — | cream cheese, sugar, cream, lotus biscoff biscuit, lotus biscoff spread, wheat flour, caramelised sugar, cinnamon, soy flour, butter | [Cheesecake](https://en.wikipedia.org/wiki/Cheesecake) | medium | Lotus Biscoff biscuits contain soy flour; kitchen to confirm egg (baked or no-bake) and no gelatine. |
| Classic Cheese Cake | milk, egg, wheat | Vegetarian | cream cheese, sugar, egg, vanilla, biscuit crust, wheat flour, butter | [Cheesecake](https://en.wikipedia.org/wiki/Cheesecake) | high | Kitchen to confirm: the crust (digestive or graham biscuits). |
| Coffee & walnut cake | wheat, milk, egg, tree nuts | Vegetarian | wheat flour, butter, sugar, egg, coffee, walnut, icing sugar | [Coffee and walnut cake](https://en.wikipedia.org/wiki/Coffee_and_walnut_cake) | high |  |
| Napoleon | wheat, milk, egg | Vegetarian | puff pastry, wheat flour, butter, milk, egg, sugar, cornstarch, vanilla, powdered sugar | [Mille-feuille](https://en.wikipedia.org/wiki/Mille-feuille) | medium | Kitchen to confirm: pastry cream (egg) or whipped-cream filling, and the topping. |
| Chocolate Croissant | wheat, milk, egg | Vegetarian | croissant, wheat flour, butter, yeast, milk, sugar, egg, chocolate | [Pain au chocolat](https://en.wikipedia.org/wiki/Pain_au_chocolat) | medium | Kitchen to confirm: chocolate bar or chocolate-cream filling, soy lecithin in the chocolate, egg wash. |
| Baklava Cake | wheat, egg, milk, tree nuts | — | wheat flour, egg, sugar, butter, walnut, pistachio, sugar syrup | [Baklava](https://en.wikipedia.org/wiki/Baklava) | low | Recipe not public: venue to confirm the cake (which nuts, syrup or honey, any filo, butter). |
| Chocolate Late Cake | wheat, egg, milk | Vegetarian | wheat flour, cocoa powder, chocolate, sugar, egg, butter, milk | [Chocolate cake](https://en.wikipedia.org/wiki/Chocolate_cake) | low | English name "Late" is unclear (lava, layer or latte?); the Persian name says only کیک شکلاتی; venue to confirm. |
| Ice Cream | milk | Vegetarian | milk, cream, sugar | [Ice cream](https://en.wikipedia.org/wiki/Ice_cream) | medium | Options: pistachio (tree nuts), saffron (Persian ice cream: egg yolk, often pistachio), chocolate (may contain soy); kitchen to confirm egg in the bases and no gelatine. |
| Single Scoop Ice Cream | milk | Vegetarian | milk, cream, sugar | [Ice cream](https://en.wikipedia.org/wiki/Ice_cream) | medium | Options: pistachio (tree nuts), saffron (Persian ice cream: egg yolk, often pistachio), chocolate (may contain soy); kitchen to confirm egg in the bases and no gelatine. |
| Ice cream Sandwich | milk, egg, tree nuts, wheat | Vegetarian | persian ice cream, milk, cream, sugar, egg yolk, saffron, rose water, pistachio, wafer, wheat flour | [Ice cream sandwich](https://en.wikipedia.org/wiki/Ice_cream_sandwich) | medium | Bastani nooni assumed (saffron ice cream with egg yolk and pistachio); kitchen to confirm, and soy in the wafers. |
| Falooda | wheat | Vegan | starch noodle, sugar, rose water, lime juice, water | [Faloodeh](https://en.wikipedia.org/wiki/Faloodeh) | medium | Kitchen to confirm: noodle starch (wheat starch is common in Iran), pistachio garnish, bottled lime juice (sulphites). Wheat drafted because faloodeh noodles are made from starch and wheat starch is common in Iran (some use corn starch): kitchen to confirm the starch. |
| Chocolate Milkshake | milk | Vegetarian | ice cream, milk, chocolate sauce | [Milkshake](https://en.wikipedia.org/wiki/Milkshake) | medium | kitchen to confirm: ice cream flavour, egg and gelatine in the ice cream, whipped cream or toppings |
| Strawberry Milkshake | milk | Vegetarian | strawberry, ice cream, milk | [Milkshake](https://en.wikipedia.org/wiki/Milkshake) | medium | kitchen to confirm fresh strawberries or syrup, egg and gelatine in the ice cream, any toppings |
| Mango Milkshake | milk | Vegetarian | mango, ice cream, milk | [Milkshake](https://en.wikipedia.org/wiki/Milkshake) | medium | kitchen to confirm fresh mango or pulp, egg and gelatine in the ice cream, any toppings |
| Nutella Milkshake | milk, tree nuts, soy | Vegetarian | nutella (hazelnut cocoa spread), hazelnut, cocoa, ice cream, milk | [Milkshake](https://en.wikipedia.org/wiki/Milkshake) | medium | Nutella contains hazelnuts, skimmed milk and soy lecithin (Wikipedia, Nutella); kitchen to confirm egg/gelatine in the ice cream and toppings |
| Brain & Tongue Omelette | egg | — | egg, brain, tongue | [Omelette](https://en.wikipedia.org/wiki/Omelette) | low | Recipe not public: venue to confirm the animal (lamb or beef), the cooking fat (butter adds milk) and the sides (bread, cheese). |
| Classic Eggs | egg, wheat, milk | Vegetarian | egg, bread, fresh herbs, cheese, tomato, cucumber | [Fried egg](https://en.wikipedia.org/wiki/Fried_egg) | high | Kitchen to confirm the cooking fat (butter or oil). |
| Tomato Omelette | egg, wheat, milk | Vegetarian | egg, tomato, onion, bread, fresh herbs, cheese, cucumber | [Omelette](https://en.wikipedia.org/wiki/Omelette) | high |  |
| Halim | wheat, milk | — | wheat, meat, cinnamon, sugar, butter | [Haleem](https://en.wikipedia.org/wiki/Haleem) | medium | Kitchen to confirm the meat (turkey, lamb or beef) and the butter or ghee topping (milk), which the source gives as usual in Iran. |
| Sausage & Egg | egg, wheat, milk | — | beef sausage, beef, egg, bread, fresh herbs, cheese, tomato, cucumber | [Sausage](https://en.wikipedia.org/wiki/Sausage) | medium | Kitchen to confirm the sausage (fillers can add wheat, soy, mustard). |
| Sausage, Egg & Tomato | egg, wheat, milk | — | beef sausage, beef, egg, tomato, bread, fresh herbs, cheese, cucumber | [Sausage](https://en.wikipedia.org/wiki/Sausage) | medium | Kitchen to confirm the sausage (fillers can add wheat, soy, mustard). |
| Turkish Omelette | egg, wheat, milk | — | sujuk, egg, onion, bread, fresh herbs, cheese, tomato, cucumber | [Sujuk](https://en.wikipedia.org/wiki/Sujuk) | high | Sujuk is usually beef (kitchen to confirm); "Sujok" in the English description is usually spelled sujuk or sucuk. |
| Bandar Omelette | egg, wheat, milk | Vegetarian | date, egg, bread, fresh herbs, cheese, tomato, cucumber | [Omelette](https://en.wikipedia.org/wiki/Omelette) | high | Kitchen to confirm the cooking fat (butter or oil). |
| Jungle Omelette | egg, wheat, milk | Vegetarian | egg, tomato, feta cheese, fresh herbs, mixed peppers, bread, cucumber, onion | [Omelette](https://en.wikipedia.org/wiki/Omelette) | high |  |
| Nargasi Omelette | egg | Vegetarian | egg, spinach, onion, mushroom | [Nargesi (food)](https://en.wikipedia.org/wiki/Nargesi_(food)) | high | Kitchen to confirm the cooking fat (butter adds milk) and any bread or cheese served. |
| Gheymagh | milk, wheat | Vegetarian | clotted cream, cream, honey, feta cheese, bread | [Kaymak](https://en.wikipedia.org/wiki/Kaymak) | high |  |
| Mushroom Tomato Omelette | egg, wheat, milk | Vegetarian | egg, mushroom, onion, tomato, bread, fresh herbs, cheese, cucumber | [Omelette](https://en.wikipedia.org/wiki/Omelette) | high |  |
| Papa Egg (Roast beef) | egg | — | egg, roast beef | [Roast beef](https://en.wikipedia.org/wiki/Roast_beef) | low | House recipe not public: venue to confirm how the eggs are cooked and the sides (bread, cheese, herbs as on the other breakfasts). |
| Cheese Platter | wheat, milk | Vegetarian | bread, cheese, fresh herbs | [Sabzi khordan](https://en.wikipedia.org/wiki/Sabzi_khordan) | medium | Venue to confirm the cheese and bread, and whether walnuts (tree nuts), tomato or cucumber come with it. |
| Plain Bagel With Cream Cheese | wheat, milk | Vegetarian | bagel, wheat flour, cream cheese | [Bagel](https://en.wikipedia.org/wiki/Bagel) | high | Kitchen to confirm the bagel dough (many contain barley malt, some egg or milk). |
| Everything Bagel With Cream Cheese | wheat, sesame, milk | Vegetarian | bagel, wheat flour, sesame seed, poppy seed, garlic, onion, salt, cream cheese | [Everything bagel](https://en.wikipedia.org/wiki/Everything_bagel) | high | Topping mix varies: kitchen to confirm it, and the dough (barley malt, egg or milk). |
| Plain Bagel with Butter | wheat, milk | Vegetarian | bagel, wheat flour, butter | [Bagel](https://en.wikipedia.org/wiki/Bagel) | high | Kitchen to confirm the bagel dough (many contain barley malt, some egg or milk). |
| Everything Bagel With Butter | wheat, sesame, milk | Vegetarian | bagel, wheat flour, sesame seed, poppy seed, garlic, onion, salt, butter | [Everything bagel](https://en.wikipedia.org/wiki/Everything_bagel) | high | Topping mix varies: kitchen to confirm it, and the dough (barley malt, egg or milk). |
| Classic waffle | wheat, egg, milk | Vegetarian | wheat flour, egg, milk, butter, sugar | [Waffle](https://en.wikipedia.org/wiki/Waffle) | medium | Toppings not public: venue to confirm (syrup, cream, fruit; Nutella would add tree nuts and soy). |
| Senso Waffle | wheat, egg, milk | — | wheat flour, egg, milk, butter, sugar | [Waffle](https://en.wikipedia.org/wiki/Waffle) | low | House recipe not public: venue to confirm the toppings and their allergens; only a standard waffle batter is assumed. |
| Strawberry pancake | wheat, egg, milk | Vegetarian | wheat flour, egg, milk, butter, sugar, strawberry | [Pancake](https://en.wikipedia.org/wiki/Pancake) | medium | Venue to confirm any other toppings (syrup, cream, Nutella: tree nuts, soy). |
| Mixed Green Salad | tree nuts, milk | Vegetarian | spring mix, sunflower seed, walnut, strawberry, blackberry, raspberry, feta cheese | [Salad](https://en.wikipedia.org/wiki/Salad) | medium | Options: Atlantic salmon (fish), chicken. Dressing not stated: kitchen to confirm. Persian شاه‌توت for blackberries usually means black mulberry: Kian to judge. |
| Greek Salad | milk | Vegetarian | cucumber, tomato, red onion, olive, lemon juice, olive oil, feta cheese | [Greek salad](https://en.wikipedia.org/wiki/Greek_salad) | medium | Feta is the typical cheese of a Greek salad but the description names none: milk drafted as a precaution, kitchen to confirm. Options: Atlantic salmon (fish), chicken. |
| Watermelon Salad | milk | Vegetarian | watermelon, feta cheese, pomegranate | [Watermelon](https://en.wikipedia.org/wiki/Watermelon) | high | Dressing or herbs not stated: kitchen to confirm. |
| Caesar Salad | wheat, milk, egg, fish, mustard | — | romaine lettuce, crouton, parmesan cheese, caesar dressing, garlic, egg, olive oil, lemon juice, worcestershire sauce, anchovy, dijon mustard, black pepper | [Caesar salad](https://en.wikipedia.org/wiki/Caesar_salad) | medium | Options: Atlantic salmon (fish), chicken. Kitchen to confirm the dressing (egg; anchovy or Worcestershire = fish; Dijon = mustard). |
| Creamy Mushroom Barley Soup | milk, barley | — | milk, chicken, mushroom, barley, carrot, parsley, onion | [Cream of Barley Soup (Soup Jo) - The Delicious Crescent](https://www.thedeliciouscrescent.com/persian-creamy-barley-soup/) | high | Kitchen to confirm any cream, butter or flour (wheat) used to thicken it. |
| Ashe Sabzi Shiraz | — | — | leek, tarragon, rice, chickpea, lentil, white bean, onion, fried onion, lamb, turmeric, black pepper, dried savory | [طرز تهیه آش سبزی؛ صبحانه معروف شیرازی - کجارو](https://www.kojaro.com/food/191386-ash-sabzi-shirazi/) | medium | Shiraz recipe uses shredded lamb and no kashk: kitchen to confirm the meat, the herbs and any kashk (milk) or bread (wheat). |
| Ashe Reshteh | wheat, milk | Vegetarian | reshteh, noodle, fresh herbs, kidney bean, chickpea, lentil, kashk, fried onion, dried mint, garlic, turmeric | [Aush reshteh](https://en.wikipedia.org/wiki/Aush_reshteh) | high | Kitchen to confirm no meat stock. |
| Kumpir (Turkish Style Stuffed Baked Potato) | milk, egg | — | potato, butter, mozzarella cheese, spicy mayonnaise, tomato, olive, pickle, corn, mushroom, salami, sausage | [Kumpir](https://en.wikipedia.org/wiki/Kumpir) | high | Kitchen to confirm the mayonnaise (mustard), salami and sausage (wheat, soy, mustard) and pickles (sulphites). |
| Barley Soup | barley, milk | — | carrot, onion, barley, chicken, tomato paste, milk | [Soup-e Jow - Barley soup - The Caspian Chef](https://thecaspianchef.com/soup-e-jow-barley-soup/) | medium | Kitchen to confirm: the source recipe finishes with milk, but Senso also has a separate creamy version, so this one may have no milk. |
| chips o panir | milk | — | potato, french fries, cheese, vegetable oil | [Cheese fries](https://en.wikipedia.org/wiki/Cheese_fries) | low | Venue to confirm the cheese and any toppings (mushroom, sausage, sauce), often added in Iran. |
| Mexican corn | milk, egg | Vegetarian | sweet corn, butter, mayonnaise, cheese, salt, black pepper | [Esquites](https://en.wikipedia.org/wiki/Esquites) | medium | Iranian cup-corn version assumed (corn, butter, mayonnaise, pizza cheese, sometimes mushroom): kitchen to confirm; Persian name spelled میکزیکی (usual: مکزیکی). |
| Adasi | — | Vegetarian | lentil, potato, onion, garlic, turmeric, vegetable oil | [Adasi Persian Lentil Soup Recipe • Unicorns in the Kitchen](https://www.unicornsinthekitchen.com/adasi-persian-lentil-soup-recipe/) | medium | Kitchen to confirm no meat stock and whether butter (milk) is used, as in some recipes. |
| Signature Senso Mix Sandwich | wheat, milk | — | bread, turkey slices, chicken slices, mushroom sauce, signature sauce, tomato, pickle, lettuce, stick chips, potato | [Sandwich](https://en.wikipedia.org/wiki/Sandwich) | medium | Bread assumed; kitchen to confirm the mushroom sauce: cream or butter (milk), flour, wine (sulphites); signature sauce and cold cuts not public (egg, mustard, soy possible). |
| Tongue Sandwich | wheat, milk | — | bread, beef tongue, mushroom sauce, fried onion, stick chips, potato | [Beef tongue](https://en.wikipedia.org/wiki/Beef_tongue) | medium | Bread assumed; kitchen to confirm beef or lamb tongue; kitchen to confirm the mushroom sauce: cream or butter (milk), flour, wine (sulphites). |
| Sosis Bandari Plate | — | — | beef sausage, onion, tomato paste, chilli pepper, spices, vegetable oil | [Sosis Bandari](https://en.wikipedia.org/wiki/Sosis_Bandari) | medium | Venue to confirm the sides (bread or fries: wheat) and the sausage (fillers can add wheat, soy, mustard). |
| Sosis Plate | — | — | beef sausage, vegetable oil | [Sausage](https://en.wikipedia.org/wiki/Sausage) | low | Plate contents not public: venue to confirm the sausage and the sides (bread, fries, pickles, tomato). |
| Smoked Montreal Roast Beef Sandwich | wheat | — | smoked roast beef, bread | [Roast beef sandwich](https://en.wikipedia.org/wiki/Roast_beef_sandwich) | low | Recipe not public: venue to confirm the bread, sauces and toppings (mustard, cheese, pickles). |
| Smoked Turkey Breast Sandwich | wheat | — | smoked turkey breast, bread | [Sandwich](https://en.wikipedia.org/wiki/Sandwich) | low | Recipe not public: venue to confirm the bread, sauces and toppings. |
| Smoked Chicken Breast Sandwich | wheat | — | smoked chicken breast, bread | [Chicken sandwich](https://en.wikipedia.org/wiki/Chicken_sandwich) | low | Recipe not public: venue to confirm the bread, sauces and toppings. |
| Cheese Pizza | wheat, milk | Vegetarian | pizza dough, tomato sauce, mozzarella cheese, cheddar cheese, marble cheese | [Pizza](https://en.wikipedia.org/wiki/Pizza) | high | Tomato sauce assumed (typical, not named). |
| Meat Lovers Pizza | wheat, milk | — | pizza dough, mushroom sauce, steak, beef bacon, ham, beef sausage, black olive, mozzarella cheese | [Pizza](https://en.wikipedia.org/wiki/Pizza) | medium | Kitchen to confirm the mushroom sauce: cream or butter (milk), flour, wine (sulphites); processed meats may add wheat, soy, mustard; which meat the ham is. |
| persian pizza | wheat, milk | — | pizza dough, tomato sauce, mozzarella cheese, cheddar cheese, beef, corn, salami, beef sausage, mushroom, red onion, green pepper, black olive | [Pizza](https://en.wikipedia.org/wiki/Pizza) | high | Kitchen to confirm the salami and sausage (fillers can add wheat, soy, mustard). |
| Steak Pizza | wheat, milk | — | pizza dough, garlic butter, butter, garlic, mushroom sauce, steak, mozzarella cheese, chilli, red onion | [Pizza](https://en.wikipedia.org/wiki/Pizza) | medium | Kitchen to confirm the mushroom sauce: cream or butter (milk), flour, wine (sulphites). |
| Vegetarian Pizza | wheat, milk | Vegetarian | pizza dough, tomato sauce, cheese, mushroom, red onion, corn, bell pepper, green olive, black olive, crushed tomato, feta cheese | [Pizza](https://en.wikipedia.org/wiki/Pizza) | high |  |
| Papa pizza (roast beef) | wheat, milk | — | flat bread, mushroom, mozzarella cheese, roast beef, black olive, corn | [Pizza](https://en.wikipedia.org/wiki/Pizza) | high |  |
| Mama pizza (Grilled chicken Salami,beef bacon) | wheat, milk | — | flat bread, chicken, beef, salami, beef bacon, mozzarella cheese, tomato sauce, mushroom, black olive | [Pizza](https://en.wikipedia.org/wiki/Pizza) | medium | Kitchen to confirm the processed meats (fillers can add wheat, soy, mustard). |
| Canada Dry Ginger Ale | — | Vegan | carbonated water, sugar (glucose-fructose), natural ginger flavour, citric acid | [Canada Dry](https://en.wikipedia.org/wiki/Canada_Dry) | high |  |
| Coca Cola | — | Vegan | carbonated water, sugar (glucose-fructose), caramel colour, phosphoric acid, natural flavour, caffeine | [Coca-Cola](https://en.wikipedia.org/wiki/Coca-Cola) | high |  |
| Mineral water | — | Vegan | mineral water | [Mineral water](https://en.wikipedia.org/wiki/Mineral_water) | high | venue to confirm still or sparkling |
| Extra Beef Bacon | — | — | beef bacon | [Bacon](https://en.wikipedia.org/wiki/Bacon) | medium | Kitchen to confirm the product (cured beef; check its label for allergens). |
| Extra Bread (2 Slices) | wheat | Vegetarian | bread, wheat flour | [Bread](https://en.wikipedia.org/wiki/Bread) | medium | Venue to confirm the bread (barbari, sangak, toast?) and whether it has milk, egg or sesame. |
| Extra Sausage | — | — | beef sausage | [Sausage](https://en.wikipedia.org/wiki/Sausage) | medium | Kitchen to confirm the sausage (beef assumed; fillers can add wheat, soy, mustard). |
| Extra Egg | egg | Vegetarian | egg | [Eggs as food](https://en.wikipedia.org/wiki/Eggs_as_food) | high |  |
| Extra Sujuk | — | — | sujuk, beef, spices | [Sujuk](https://en.wikipedia.org/wiki/Sujuk) | high | Sujuk is usually beef, sometimes lamb: kitchen to confirm. |
| Date | — | Vegan | date | [Date palm](https://en.wikipedia.org/wiki/Date_palm) | high |  |
| Extra Honey | — | Vegetarian | honey | [Honey](https://en.wikipedia.org/wiki/Honey) | high |  |
| Extra cheese | milk | Vegetarian | cheese | [Cheese](https://en.wikipedia.org/wiki/Cheese) | medium | Venue to confirm which cheese (breakfast white cheese or pizza mozzarella). |
| Nutella | tree nuts, milk, soy | Vegetarian | sugar, palm oil, hazelnut, skimmed milk powder, cocoa, soy lecithin | [Nutella](https://en.wikipedia.org/wiki/Nutella) | high |  |
| Extra Gheymagh | milk | Vegetarian | clotted cream | [Kaymak](https://en.wikipedia.org/wiki/Kaymak) | medium | At 16.49 this may be a full portion: venue to confirm whether honey, feta or bread (wheat) come with it. |
| Extra Mushroom | — | — | mushroom | [Edible mushroom](https://en.wikipedia.org/wiki/Edible_mushroom) | medium | Kitchen to confirm whether they are cooked in butter (milk). |
| Ginger shot | — | — | ginger | [Ginger](https://en.wikipedia.org/wiki/Ginger) | low | Recipe not public: venue to confirm what else is in it (lemon, apple, honey, turmeric). |
| Nabat | — | Vegan | sugar | [Rock candy](https://en.wikipedia.org/wiki/Rock_candy) | high | Venue to confirm plain or saffron nabat. |

## New descriptions (English and Persian drafts)

| Item | English | Persian |
| --- | --- | --- |
| Carrot Juice with Ice cream | Fresh carrot juice topped with a scoop of ice cream, the Iranian juice-bar classic you sip and spoon at once. | آب هویج تازه با یک اسکوپ بستنی؛ همان آب هویج بستنی آشنای آبمیوه‌فروشی‌های ایران، هم نوشیدنی و هم دسر. |
| Ice cream & Falooda | Persian falooda, thin icy starch noodles in rose-water syrup with lime, served with a scoop of traditional Persian ice cream. | فالوده‌ی خنک با رشته‌های نشاسته‌ای نازک، شربت گلاب و آب‌لیمو، همراه یک اسکوپ بستنی سنتی. |
| Banana & Pistachio Milk | Ripe banana and pistachio blended with cold milk into a thick, smooth shake, Iranian juice-bar style. | موز رسیده و پسته که با شیر خنک مخلوط شده؛ شیرموزی غلیظ و لطیف به سبک آبمیوه‌فروشی‌های ایران. |
| Pomegranate majoun | A pomegranate twist on majoun, the thick Iranian ice cream treat eaten with a spoon; sweet, tart and cool. | معجون با طعم انار؛ دسر غلیظ ایرانی بر پایه بستنی که با قاشق خورده می‌شود، ملس و خنک. |
| Turkish Coffee | Finely ground coffee brewed unfiltered the traditional way: strong, rich and crowned with a velvety foam. | قهوهٔ ریزآسیاب، دم‌شده به روش سنتی و بدون فیلتر؛ غلیظ و خوش‌عطر با کفی مخملی روی فنجان. |
| Brewing Coffee | Freshly brewed coffee, smooth and full-bodied, in a medium or large cup. | قهوهٔ دمی تازه، نرم و پرطعم؛ در اندازهٔ متوسط یا بزرگ. |
| Espresso | A short, concentrated shot of coffee under a golden crema; single or double. | عصارهٔ غلیظ و کوتاه قهوه با کرمای طلایی؛ سینگل یا دبل. |
| Americano | Espresso lengthened with hot water: all its depth in a longer, lighter cup. | اسپرسو با آب داغ؛ عمق طعم اسپرسو در فنجانی بزرگ‌تر و ملایم‌تر. |
| Latte | Espresso and silky steamed milk under a thin layer of foam: smooth and mellow. | اسپرسو و شیر بخارداده با بافتی مخملی و لایه‌ای نازک از فوم؛ نرم و ملایم. |
| Organic Beet Latte | Organic beetroot and steamed milk in a vivid pink cup, velvety with a gentle earthy sweetness. | چغندر ارگانیک و شیر بخارداده؛ لاته‌ای صورتی‌رنگ و مخملی با شیرینی ملایم چغندر. |
| Cappuccino | Espresso and steamed milk beneath a thick, airy cap of milk foam; shorter and bolder than a latte. | اسپرسو و شیر بخارداده با لایه‌ای ضخیم و سبک از فوم شیر؛ کوچک‌تر و پرطعم‌تر از لاته. |
| Mocha | Espresso, chocolate and steamed milk: a latte with the warmth of hot chocolate. | اسپرسو، شکلات و شیر بخارداده؛ لاته‌ای با طعم گرم و دلپذیر هات‌چاکلت. |
| Caramel Macchiato | Vanilla-scented steamed milk marked with espresso and finished with caramel sauce: layered, sweet and velvety. | شیر بخارداده با عطر وانیل، اسپرسو و رگه‌های سس کارامل؛ لایه‌لایه، شیرین و مخملی. |
| Affogato | A scoop of vanilla ice cream drowned in a hot shot of espresso: dessert and coffee in one. | یک اسکوپ بستنی وانیلی غرق در شات داغ اسپرسو؛ دسر و قهوه در یک فنجان. |
| Hot chocolate | Chocolate and steamed milk in a warm, smooth and velvety cup. | شکلات و شیر بخارداده؛ نوشیدنی گرم، غلیظ و مخملی. |
| Matcha Latte | Matcha green tea and steamed milk: bright green, velvety and gently grassy. | ماچا (پودر چای سبز) و شیر بخارداده؛ سبز روشن، مخملی و با طعم ملایم چای سبز. |
| Tea | Freshly brewed black tea, clear, amber and fragrant. | چای سیاه تازه‌دم؛ خوش‌رنگ و خوش‌عطر. |
| Large Tea | A larger serving of freshly brewed black tea, clear, amber and fragrant. | چای سیاه تازه‌دم در اندازهٔ بزرگ؛ خوش‌رنگ و خوش‌عطر. |
| Borage with lime | Persian borage flowers steeped with dried lime: floral, gently tart and fragrant. | گل گاوزبان ایرانی با لیمو عمانی؛ دمنوشی خوش‌رنگ، ملس و معطر. |
| Allergy Herbal Tea | A herbal blend of borage flower, orange blossom, thyme, mint, cinnamon, valerian, lemon verbena, ginger, saffron rock candy and rose water. | (the venue's own) |
| Apple & Cinnamon Herbal Tea | Apple and cinnamon steeped together: a warm, fruity cup with a gentle sweet spice. | سیب و دارچین دم‌کرده؛ دمنوشی گرم و میوه‌ای با عطر شیرین دارچین. |
| Green tea | Delicate green tea, light and grassy with a clean, gentle finish. | چای سبز با طعمی لطیف و تازه و عطری ملایم. |
| Saffron Herbal Tea | Saffron threads steeped into a golden, fragrant cup with a delicate floral aroma. | زعفران دم‌کرده در فنجانی طلایی‌رنگ و خوش‌عطر، با رایحه‌ای لطیف و دل‌نشین. |
| Ice pistachio latte | Espresso, cold milk and pistachio over ice: nutty, smooth and refreshing. | اسپرسو، شیر سرد و پسته روی یخ؛ خنک و مخملی با طعم دل‌نشین پسته. |
| Ice saffron latte | Espresso and cold milk with saffron over ice: golden, fragrant and smooth. | اسپرسو و شیر سرد با زعفران روی یخ؛ طلایی، خوش‌عطر و مخملی. |
| Iced Latte | Espresso and cold milk poured over ice: smooth, mellow and refreshing. | اسپرسو و شیر سرد روی یخ؛ نرم، ملایم و خنک. |
| Iced Americano | Espresso with cold water over ice: bold, clean and refreshing. | اسپرسو با آب سرد روی یخ؛ پرطعم، سبک و خنک. |
| Iced Matcha Latte | Matcha green tea and cold milk over ice: bright green, smooth and gently grassy. | ماچا و شیر سرد روی یخ؛ سبز روشن، خنک و با طعم ملایم چای سبز. |
| Green Mojito | An alcohol-free mojito of fresh mint and lime over ice: zesty, cool and lightly sweet. | موهیتوی بدون الکل با نعنای تازه و لیموترش روی یخ؛ خنک، ملس و پرطراوت. |
| Cantaloupe | Fresh cantaloupe juice, chilled, smooth and sweet with the fragrance of ripe melon. | آب طالبی تازه؛ خنک، لطیف و شیرین با عطر طالبی رسیده. |
| Orange | Freshly squeezed orange juice: bright, sweet and tangy. | آب پرتقال تازه‌گرفته؛ شیرین، ملس و پرطراوت. |
| Mango | Ripe mango juice, thick, smooth and tropical, served chilled. | آب انبهٔ رسیده؛ غلیظ، لطیف و خنک با طعم گرمسیری انبه. |
| Watermelon | Fresh watermelon juice: light, sweet and cool. | آب هندوانهٔ تازه؛ سبک، شیرین و خنک. |
| Carrot Juice | Freshly pressed carrot juice: sweet, earthy and bright orange. | آب هویج تازه‌گرفته؛ شیرین، خوش‌رنگ و خنک. |
| Celery Juice | Freshly pressed celery juice: crisp, green and pleasantly savoury. | آب کرفس تازه‌گرفته؛ سبز و خنک با عطر و طعم تازهٔ کرفس. |
| Caramel Tres Leches | Light sponge soaked in three milks, topped with whipped cream and caramel sauce; soft, cool and gently sweet. | کیک اسفنجی سبک که در سه نوع شیر خیس خورده، با رویه خامه و سس کارامل؛ نرم و خنک با شیرینی ملایم. |
| Dubai Chocolate Cheesecake | Creamy cheesecake with the flavours of Dubai chocolate: milk chocolate, pistachio cream and crisp shredded kataifi pastry. | چیزکیک خامه‌ای با طعم‌های شکلات دبی: شکلات شیری، کرم پسته و رشته‌های ترد کادایف. |
| Nutella Oreo Cheesecake | Creamy cheesecake with Nutella hazelnut-cocoa spread and crunchy Oreo cookies, a treat for chocolate lovers. | چیزکیک خامه‌ای با کرم فندق و کاکائوی نوتلا و بیسکویت ترد اورئو؛ برای دوستداران شکلات. |
| Pistachio Cake | Soft, moist cake made with ground pistachios, gently sweet and lovely with an afternoon coffee. | کیک نرم و مرطوب با پسته آسیاب‌شده و شیرینی ملایم؛ کنار یک فنجان قهوه عصرانه می‌چسبد. |
| Pistachio Cheesecake | Smooth, creamy cheesecake with the nutty, gently sweet flavour of pistachio. | چیزکیک لطیف و خامه‌ای با طعم ملایم و دلنشین پسته. |
| Small Baklava | A small piece of baklava: crisp, buttery filo layered with chopped nuts and soaked in syrup, made for tea or coffee. | یک تکه کوچک باقلوا: لایه‌های ترد و کره‌ای خمیر فیلو با مغزهای خردشده و شربت؛ کنار چای یا قهوه. |
| Large Baklava | A larger portion of baklava: crisp, buttery filo with chopped nuts and syrup, good for sharing over tea or coffee. | باقلوا در اندازه بزرگ‌تر: لایه‌های ترد و کره‌ای خمیر فیلو با مغزهای خردشده و شربت؛ مناسب دورهمی کنار چای یا قهوه. |
| Turkish Knafeh | Served warm: crisp shredded kadayif pastry around melted cheese, soaked in syrup and topped with crushed pistachio. | کنافه داغ به سبک ترکی: رشته‌های ترد کادایف با مغز پنیر کش‌دار، آغشته به شربت و پودر پسته. |
| Lotus cheesecake | Creamy cheesecake made with Lotus Biscoff biscuits and spread, full of their caramel and cinnamon notes. | چیزکیک خامه‌ای با بیسکویت و کرم لوتوس، با طعم کاراملی و کمی دارچین. |
| Classic Cheese Cake | A classic baked cheesecake: smooth, rich cream cheese filling on a buttery biscuit base. | چیزکیک تنوری کلاسیک: پنیر خامه‌ای لطیف و غلیظ روی کف بیسکویتی کره‌ای. |
| Coffee & walnut cake | Soft coffee sponge with walnuts, filled and topped with coffee butter icing; a classic British teatime cake. | کیک اسفنجی نرم با قهوه و گردو، با لایه و رویه کرم کره‌ای قهوه؛ کیک کلاسیک عصرانه به سبک انگلیسی. |
| Napoleon | Crisp layers of puff pastry with smooth vanilla pastry cream, dusted with powdered sugar. | لایه‌های ترد خمیر هزارلا با کرم وانیلی لطیف و پودر قند؛ همان ناپلئونی آشنای قنادی‌ها. |
| Chocolate Croissant | A buttery, flaky croissant with a chocolate filling; a sweet companion for your morning coffee. | کروسان کره‌ای و لایه‌لایه با مغز شکلات؛ همراهی شیرین برای قهوه صبح. |
| Baklava Cake | A cake made in the style of baklava: a soft slice with chopped nuts and syrup that recalls the classic pastry. | کیکی به سبک باقلوا: برشی نرم با مغزهای خردشده و شربت که طعم آشنای باقلوا را به یاد می‌آورد. |
| Chocolate Late Cake | A moist chocolate cake, deep in cocoa flavour; a slice to go with your coffee. | کیک شکلاتی مرطوب با طعم پررنگ کاکائو؛ برشی دلچسب کنار قهوه‌تان. |
| Ice Cream | Creamy ice cream in your choice of seven flavours, from Persian classics to fruity favourites. | بستنی خامه‌ای در هفت طعم به انتخاب شما، از طعم‌های سنتی ایرانی تا میوه‌ای. |
| Single Scoop Ice Cream | One scoop of creamy ice cream in your choice of seven flavours, from Persian classics to fruity favourites. | یک اسکوپ بستنی خامه‌ای با هفت طعم به انتخاب شما، از سنتی ایرانی تا میوه‌ای. |
| Ice cream Sandwich | Traditional Persian ice cream pressed between two thin, crisp wafers: the Iranian ice cream sandwich known as bastani nooni. | بستنی سنتی میان دو ویفر نازک و ترد؛ همان بستنی نونی آشنای ایرانی. |
| Falooda | Persian falooda: thin starch noodles, icy in rose-water syrup and finished with a squeeze of lime; cool and floral. | فالوده‌ی ایرانی: رشته‌های نشاسته‌ای نازک و یخ‌زده در شربت گلاب، با چند قطره آب‌لیمو؛ خنک و خوش‌عطر. |
| Chocolate Milkshake | Ice cream, cold milk and chocolate blended thick and velvety. | بستنی، شیر سرد و شکلات؛ میلک‌شیکی غلیظ و مخملی. |
| Strawberry Milkshake | Strawberries, ice cream and cold milk blended thick, velvety and fruity. | توت‌فرنگی، بستنی و شیر سرد؛ میلک‌شیکی غلیظ، مخملی و میوه‌ای. |
| Mango Milkshake | Ripe mango, ice cream and cold milk blended thick, velvety and tropical. | انبهٔ رسیده، بستنی و شیر سرد؛ میلک‌شیکی غلیظ و مخملی با طعم گرمسیری انبه. |
| Nutella Milkshake | Nutella, ice cream and cold milk blended into a thick, velvety shake of cocoa and hazelnut. | نوتلا، بستنی و شیر سرد؛ میلک‌شیکی غلیظ و مخملی با طعم کاکائو و فندق. |
| Brain & Tongue Omelette | Eggs cooked with tender tongue and brain, a hearty Persian breakfast plate. | تخم‌مرغ با زبان و مغز پخته و لطیف؛ صبحانه‌ای ایرانی و پر و پیمان. |
| Halim | Silky wheat and meat porridge, slow-cooked the Persian way and served with cinnamon and sugar. | حلیم کش‌دار گندم و گوشت، همراه با دارچین و شکر. |
| Papa Egg (Roast beef) | Eggs with sliced roast beef, a warm and filling start to the day. | تخم‌مرغ با برش‌های رست بیف؛ صبحانه‌ای گرم و سیرکننده. |
| Cheese Platter | Bread, cheese and fresh herbs: the simple, everyday Persian breakfast. | نان، پنیر و سبزی تازه؛ همان صبحانه‌ی ساده و همیشگی ایرانی. |
| Plain Bagel With Cream Cheese | A chewy plain bagel with smooth cream cheese, an easy café breakfast. | بیگل ساده با پنیر خامه‌ای نرم؛ صبحانه‌ای سبک و دلچسب. |
| Everything Bagel With Cream Cheese | Bagel crusted with sesame, poppy seeds, garlic, onion and salt, spread with cream cheese. | بیگل با رویه‌ی کنجد، خشخاش، سیر، پیاز و نمک، همراه با پنیر خامه‌ای. |
| Plain Bagel with Butter | A chewy plain bagel spread with butter, simple and satisfying. | بیگل ساده با کره؛ سبک و دلچسب. |
| Everything Bagel With Butter | Bagel crusted with sesame, poppy seeds, garlic, onion and salt, spread with butter. | بیگل با رویه‌ی کنجد، خشخاش، سیر، پیاز و نمک، همراه با کره. |
| Classic waffle | A warm golden waffle, crisp at the edges and soft inside. | وافل گرم و طلایی، با لبه‌های ترد و داخل نرم. |
| Senso Waffle | Senso's own house waffle, served warm. | وافل مخصوص سنسو، گرم و تازه. |
| Strawberry pancake | Soft, golden pancakes topped with fresh strawberries for a sweet, unhurried breakfast. | پنکیک نرم و طلایی با توت‌فرنگی تازه؛ برای یک صبحانه‌ی شیرین. |
| Caesar Salad | Crisp romaine, croutons and parmesan in a garlicky Caesar dressing. | کاهوی رومی ترد، کروتان و پنیر پارمزان با سس سزار سیردار. |
| Ashe Sabzi Shiraz | Thick Shiraz-style herb soup with leek, tarragon, rice, chickpeas, lentils and beans, topped with plenty of fried onion. | آش سبزی غلیظ به سبک شیراز با تره، ترخون، برنج، نخود، عدس و لوبیا، با پیاز داغ فراوان. |
| Ashe Reshteh | Thick herb, bean and noodle soup, finished with kashk, fried onion and mint. | آش غلیظ سبزی و حبوبات با رشته، همراه با کشک، پیاز داغ و نعناع داغ. |
| chips o panir | Golden fries under melted cheese, the Persian snack-bar classic. | سیب‌زمینی سرخ‌کرده‌ی طلایی زیر پنیر آب‌شده؛ همان چیپس و پنیر ساندویچی‌های ایران. |
| Mexican corn | Warm sweet corn with butter, mayonnaise and melted cheese, the way Iranian snack bars serve it. | ذرت گرم و شیرین با کره، سس مایونز و پنیر آب‌شده؛ همان ذرت مکزیکی آشنای ایرانی. |
| Sosis Bandari Plate | Sausage sautéed with onion, tomato paste and chilli, in the spicy southern Iranian bandari style. | سوسیس تفت‌داده با پیاز، رب گوجه و فلفل تند؛ به سبک بندری و خوش‌ادویه. |
| Sosis Plate | Golden pan-fried sausage, served as a simple café plate. | سوسیس تفت‌داده و طلایی؛ یک بشقاب ساده و دلچسب. |
| Smoked Montreal Roast Beef Sandwich | Smoked Montreal-style roast beef, thinly sliced and piled into a sandwich. | رست بیف دودی به سبک مونترال، برش‌خورده و نازک، لای نان. |
| Smoked Turkey Breast Sandwich | Smoked turkey breast, thinly sliced and layered into a sandwich. | سینه بوقلمون دودی، برش‌خورده و نازک، لای نان. |
| Smoked Chicken Breast Sandwich | Smoked chicken breast, thinly sliced and layered into a sandwich. | سینه مرغ دودی، برش‌خورده و نازک، لای نان. |
| Canada Dry Ginger Ale | Canada's classic dry ginger ale: crisp bubbles, light sweetness and a mild ginger bite. | جینجر ایل کلاسیک کانادایی؛ گازدار، کمی شیرین و با طعم ملایم زنجبیل. |
| Coca Cola | Classic Coca-Cola, crisp, fizzy and served cold. | کوکاکولای کلاسیک؛ گازدار، خنک و پرطراوت. |
| Mineral water | Bottled mineral water, served cold. | آب معدنی بطری، خنک. |
| Extra Beef Bacon | An extra serving of beef bacon for your plate. | یک سهم بیکن گوشت اضافه برای بشقاب شما. |
| Extra Bread (2 Slices) | Two extra slices of bread for your breakfast. | دو تکه نان اضافه برای صبحانه‌ی شما. |
| Extra Sausage | An extra serving of sausage for your plate. | یک سهم سوسیس اضافه برای بشقاب شما. |
| Extra Egg | One more egg for your breakfast. | یک تخم‌مرغ اضافه برای صبحانه‌ی شما. |
| Extra Sujuk | Extra sujuk, the spiced Turkish beef sausage. | سوجوک اضافه؛ سوسیس ترکی و خوش‌ادویه از گوشت گاو. |
| Date | Sweet dates on the side. | خرمای شیرین، کنار صبحانه. |
| Extra Honey | An extra serving of honey for your breakfast. | یک سهم عسل اضافه برای صبحانه‌ی شما. |
| Extra cheese | An extra portion of cheese. | یک سهم پنیر اضافه. |
| Nutella | A side of Nutella, the sweet hazelnut and cocoa spread. | یک سهم نوتلا، کرم شیرین فندقی و کاکائویی. |
| Extra Gheymagh | Another serving of gheymagh, thick Persian clotted cream. | یک سهم دیگر قیماق؛ سرشیر غلیظ و خامه‌ای. |
| Extra Mushroom | An extra portion of mushrooms. | یک سهم قارچ اضافه. |
| Ginger shot | A small, fiery shot of fresh ginger. | یک شات کوچک و تند از زنجبیل تازه. |
| Nabat | Persian rock sugar, the traditional sweetener for a hot cup. | نبات، برای شیرین کردن نوشیدنی گرم به رسم ایرانی. |

## The general allergy notice (every venue, from 2026-10-12)

- English: Please tell your server about any allergies before ordering. Our dishes may contain or come into contact with common allergens.
- Persian (draft for Kian): لطفاً پیش از سفارش، هرگونه حساسیت غذایی را به همکاران ما اطلاع دهید. غذاهای ما ممکن است حاوی مواد حساسیت‌زای رایج باشند یا با آن‌ها در تماس قرار بگیرند.
