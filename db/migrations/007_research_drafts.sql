-- Research drafts (Kian, 2026-10-12; this data-model change approved by him): per-field draft flags for content written from research
-- rather than by the venue, kept like fa_draft (the Persian drafts): 'description' (the English description), 'allergens' and 'dietary'
-- (the allergen and dietary notes). A drafted description is shown to customers (it sells the item) and marked as a draft in the admin;
-- drafted allergen and dietary notes never reach the public page until an owner or admin confirms them (Kian's ruling). A person's edit
-- of a field, or Confirm in the admin, clears its flag. The basis of each draft (the assumed key ingredients, the source) is recorded in
-- the item's internal source column, never rendered.
alter table items add column drafts text[] not null default '{}';
alter table items add constraint items_drafts_valid check (drafts <@ array['description', 'allergens', 'dietary']::text[]);
