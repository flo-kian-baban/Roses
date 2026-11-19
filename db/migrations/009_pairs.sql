-- "Goes well with" (Kian via the PM, 2026-11-18; this data-model change approved by Kian on 2026-11-19): up to 4
-- other items of the same venue per item, in the order picked, shown to customers at the bottom of the item's popup. One-way:
-- A listing B says nothing about B's own list.
-- A column on the item, like its seasons and its draft flags, so the list travels with the item through every save, change record,
-- Undo and Duplicate. The database keeps the rules that need no lookup (at most 4, never the item itself) and the one that must hold
-- on every path: deleting an item takes it out of every list, whoever deletes it and however (the admin's Delete, a section deleted
-- with its items, the Undo of an Add, a script), so no list ever points at an item that is gone. A list that loses an item this way
-- gets a new version (updated_at), so an editor still holding the old list is refused and shown the new one, as for any change made
-- elsewhere. That the listed items are of the same venue is the server's check (as for combo parts), made under a lock that a delete
-- waits for.
alter table items add column pairs uuid[] not null default '{}';
alter table items add constraint items_pairs_valid check (cardinality(pairs) <= 4 and not (id = any(pairs)));

create function unpair_deleted_item() returns trigger language plpgsql as $$
begin
  update items set pairs = array_remove(pairs, old.id), updated_at = now() where pairs @> array[old.id];
  return null;
end $$;
create trigger items_unpair after delete on items for each row execute function unpair_deleted_item();
