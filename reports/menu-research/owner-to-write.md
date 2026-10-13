# Descriptions for the owner to write (Kian, 2026-10-13)

The research had written a placeholder for these items, a line that only points customers to the server. On Kian's ruling of 2026-10-13 those lines are withdrawn: the items show with no description until the owner writes one (in the admin, or under "new EN" / "new FA" in the review sheet after a fresh export). Their allergen and dietary drafts stay, still to confirm. The withdrawal is in each record (`withdrawn` in `data/import/2026-10-12/<venue>/research.json`) and is applied by `tools/import/research-apply.mjs`, which clears a text only while it is still the research's untouched draft.

| Venue | Section | Item | Price | What the owner needs to say | Allergen draft (kept) | The withdrawn placeholder |
| --- | --- | --- | --- | --- | --- | --- |
| senso | Persian Breakfast | Senso Waffle | 20.99 | what makes it the Senso waffle (toppings, sauces; Nutella would add tree nuts and soy) | wheat, egg, milk | Senso's own house waffle, served warm. |
| kebab-land | Chef's Special | Chicken Rolled Fillet | 32.99 | what the fillet is rolled with (filling, marinade) and what it is served with | none found | Rolled chicken fillet, one of the chef's specials. Ask your server how it is prepared and served. |
| kebab-land | Chef's Special | Rolled Fillet Kebab | 49.99 | the meat, the filling and marinade, and the sides | none found | Rolled fillet, skewered and grilled; one of the chef's specials. Ask your server how it is prepared. |
| kebab-land | Drinks | Soft Drink | 5 | which soft drinks are offered (brands or flavours) | none found | A chilled soft drink; ask your server for today's choices. |
| kebab-land | Cocktails | Persian Dreams | 12 | what the house cocktail is made of (it also decides its allergens) | none found | Our house cocktail, mixed at the bar; your server can tell you what goes into it. |
| kebab-land | Wine Bottles | Venato (Italy) | 100 | the wine: producer, region, grape and colour (no Italian wine named "Venato" was found; possibly Veneto) | sulphites | A bottle of Italian wine; ask your server about the producer, grape and vintage. |

Kept, not withdrawn (it carries content and only ends with a pointer): **Borsao (Spain)** (kebab-land, Wine Bottles): "Spanish wine from Bodegas Borsao in Campo de Borja, Aragón, home of old-vine Garnacha; ask your server which bottle." The owner should name the bottle (Borsao makes reds, a rosé and a white), and the ending can then go.
