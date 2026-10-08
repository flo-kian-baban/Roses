-- Step 2 of the admin rebuild (Kian, 2026-10-07; authorized data-model change: per-venue style settings).
-- template: which page template renders the venue ('senso', 'kebab-land', or 'default' for venues added in the admin).
-- style: the values chosen in the Style tab for the options that template declares (empty = the template's defaults).
alter table venues add column template text not null default 'default';
alter table venues add column style jsonb not null default '{}';
update venues set template = id where id in ('senso', 'kebab-land');
