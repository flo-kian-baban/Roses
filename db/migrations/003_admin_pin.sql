-- Admin accounts sign in with a PIN (Kian, 2026-10-07): optional pin_hash; a password becomes optional when a PIN exists.
-- The email stays the account identifier. Staff and owner PINs are unchanged (table pins).
alter table admins add column pin_hash text;                  -- scrypt, "$scrypt$..."
alter table admins alter column password_hash drop not null;
alter table admins add constraint admins_credential check (password_hash is not null or pin_hash is not null);
