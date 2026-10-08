-- Kian, 2026-10-08: how a section is shown to customers, chosen per section in the Style tab (owner and admin).
-- 'list' = full-width rows with a small square photo (the kit of 2026-10-07); 'grid' = two columns with bigger photos
-- (Uber Eats-style), for sections such as juices or desserts where the photos sell. Same tokens, same item popup.
alter table sections add column layout text not null default 'list' check (layout in ('list', 'grid'));
