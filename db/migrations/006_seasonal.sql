-- Seasonal items (Kian, 2026-10-12; these data-model changes approved by him). An item can be tagged with seasons (any of fall,
-- winter, spring, summer; none = all year): outside them it is hidden everywhere, in every section it is placed in. Each venue has
-- one Seasonal section: shown first on the public page, titled by the season of the render ("Fall specials" …), holding the items
-- placed in it that are tagged for that season; it cannot be deleted, it can be hidden. The season is the existing rule (the
-- Toronto date at render, src/lib/welcome.ts seasonNow, with the hourly regeneration).
alter table items add column seasons text[] not null default '{}';
alter table items add constraint items_seasons_valid check (seasons <@ array['fall', 'winter', 'spring', 'summer']::text[]);
alter table sections add column seasonal boolean not null default false;
create unique index sections_one_seasonal_per_venue on sections (venue_id) where seasonal;

-- Every venue gets its Seasonal section when it is added (the import's venues, "+ Add venue"), and every venue there is now gets one.
-- Its name is the admin's label; customers see the season's title. Position -1: it is pinned first and outside the venue's order.
create function add_seasonal_section() returns trigger language plpgsql as $$
begin
  insert into sections (venue_id, name, note, position, listed, fa_draft, layout, seasonal)
  values (new.id, '{"en": "Seasonal", "fa": "فصلی"}', '{"en": null, "fa": null}', -1, true, '{}', 'list', true)
  on conflict do nothing;
  return new;
end $$;
create trigger venues_seasonal_section after insert on venues for each row execute function add_seasonal_section();

insert into sections (venue_id, name, note, position, listed, fa_draft, layout, seasonal)
select id, '{"en": "Seasonal", "fa": "فصلی"}', '{"en": null, "fa": null}', -1, true, '{}', 'list', true from venues
on conflict do nothing;
