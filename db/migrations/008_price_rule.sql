-- Pre-go-live audit (the PM's fix batch, 2026-11-03).
-- H-04: the database's listing rule is the app's (src/lib/rules.ts listingProblem): a shown item has a price, or sizes that all have one.
-- Before, a shown item with one unpriced size passed the SQL check. Checked first: 0 rows of the working database or of the performance
-- fixture break it.
alter table items drop constraint listed_requires_price;
alter table items add constraint listed_requires_price check (
  not listed
  or price is not null
  or (jsonb_array_length(variants) > 0 and not jsonb_path_exists(variants, '$[*] ? (!exists(@.price) || @.price == null)'))
);
-- H-17 (dead code): the view nothing reads (the editor counts what needs a price itself).
drop view if exists items_needing_price;
