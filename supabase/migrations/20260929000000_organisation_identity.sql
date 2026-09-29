-- Provider identity for training certificates.

alter table public.organisations
  add column if not exists abn text,
  add column if not exists registration_number text;

alter table public.organisations
  drop constraint if exists organisations_abn_format;

alter table public.organisations
  add constraint organisations_abn_format
  check (abn is null or abn ~ '^[0-9]{11}$');

alter table public.organisations
  drop constraint if exists organisations_registration_format;

alter table public.organisations
  add constraint organisations_registration_format
  check (
    registration_number is null
    or char_length(trim(registration_number)) between 4 and 40
  );

revoke update on table public.organisations from authenticated;
grant update (name, logo_path, abn, registration_number) on table public.organisations to authenticated;
