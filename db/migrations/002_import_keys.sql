-- Stable keys so an import can be re-run without duplicating rows.
alter table sections add column import_key text unique;
alter table items add column import_key text unique;
