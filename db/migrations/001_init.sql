-- Roses menu: initial schema. Standard Postgres only (no extensions).
-- Bilingual text is jsonb {"en": "...", "fa": null}; fa null means fall back to English.
-- Money is numeric(8,2) in CAD; null means no price known.

create table venues (
  id          text primary key,                 -- 'senso' | 'kebab-land'
  name        jsonb not null,
  tagline     jsonb not null default '{"en": null, "fa": null}',
  locations   jsonb not null default '[]',      -- [{"label": {...}, "address": "...", "phone": null, "hours": {"en": null, "fa": null}}]
  brand       jsonb not null default '{}',      -- {"logo": {...}, "colors": {...}, "fonts": {...}, "sources": [...]}
  settings    jsonb not null default '{"showPersianDrafts": true}',
  updated_at  timestamptz not null default now(),
  updated_by  jsonb
);

create table sections (
  id          uuid primary key default gen_random_uuid(),
  venue_id    text not null references venues(id),
  name        jsonb not null,
  note        jsonb not null default '{"en": null, "fa": null}',
  position    integer not null,
  listed      boolean not null default true,
  fa_draft    text[] not null default '{}',
  source      jsonb not null default '[]',      -- internal only, never rendered
  updated_at  timestamptz not null default now(),
  updated_by  jsonb
);

create table items (
  id          uuid primary key default gen_random_uuid(),
  venue_id    text not null references venues(id),
  name        jsonb not null,
  description jsonb not null default '{"en": null, "fa": null}',
  price       numeric(8,2),
  variants    jsonb not null default '[]',      -- [{"label": {"en": "6 oz", "fa": null}, "price": 9.00}]
  add_ons     jsonb not null default '[]',      -- [{"label": {...}, "price": 4.00}]
  components  jsonb not null default '[]',      -- [{"item_id": null, "label": {...}, "qty": 1}]
  serves      text,
  photo       jsonb,                            -- {"url": "...", "alt": {...}}
  notes       jsonb not null default '{"allergens": [], "dietary": [], "halal": null, "text": {"en": null, "fa": null}}',
  listed      boolean not null default false,
  fa_draft    text[] not null default '{}',
  source      jsonb not null default '[]',
  updated_at  timestamptz not null default now(),
  updated_by  jsonb,
  constraint listed_requires_price check (not listed or price is not null or jsonb_array_length(variants) > 0)
);

create table item_sections (
  item_id     uuid not null references items(id) on delete cascade,
  section_id  uuid not null references sections(id) on delete cascade,
  position    integer not null,
  primary key (item_id, section_id)
);

create table revisions (
  id          bigserial primary key,
  venue_id    text not null,
  table_name  text not null,
  row_id      text not null,
  action      text not null,                    -- create | update | delete | restore | list | unlist | import
  before      jsonb,
  after       jsonb,
  by          jsonb not null,
  at          timestamptz not null default now()
);

create table admins (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,                  -- scrypt (Node built-in), "$scrypt$..."
  name          text not null,
  created_at    timestamptz not null default now()
);

create table pins (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  role         text not null check (role in ('owner', 'staff')),
  venue_ids    text[] not null,
  pin_hash     text not null,                   -- scrypt; the PIN is shown once at creation
  created_by   uuid references admins(id),
  created_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  last_used_at timestamptz
);

create table login_failures (
  key               text primary key,           -- '<venue>:<client address>' or 'venue:<venue>'
  failures          integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until      timestamptz
);

create table admin_alerts (
  id         bigserial primary key,
  venue_id   text,
  kind       text not null,
  message    text not null,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);

create view items_needing_price as
  select i.* from items i
  where i.price is null
    and (jsonb_array_length(i.variants) = 0
         or exists (select 1 from jsonb_array_elements(i.variants) v where (v->>'price') is null));

create index items_venue_listed on items (venue_id, listed);
create index item_sections_section on item_sections (section_id, position);
create index sections_venue_position on sections (venue_id, position);
create index revisions_venue_at on revisions (venue_id, at desc);
create index revisions_row on revisions (table_name, row_id, at desc);
create index pins_venues on pins using gin (venue_ids);
create index login_failures_locked on login_failures (locked_until);
