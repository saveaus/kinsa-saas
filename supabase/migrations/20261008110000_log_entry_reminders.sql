alter table public.log_entries
  alter column storage_path drop not null,
  alter column original_filename drop not null,
  alter column mime_type drop not null,
  alter column file_size_bytes drop not null;

alter table public.log_entries
  add column due_on date,
  add column remind boolean not null default false,
  add column reminded_at timestamptz;

do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'log_registers'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%char_length(%name)%';
  if constraint_name is not null then
    execute format(
      'alter table public.log_registers drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.log_registers
  add constraint log_registers_name_check
  check (char_length(name) between 1 and 160);

create or replace function private.log_entry_matches_register()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reg public.log_registers%rowtype;
begin
  select * into reg
  from public.log_registers
  where id = new.register_id
    and organisation_id = new.organisation_id;

  if reg.id is null or reg.built_in is not null then
    raise exception 'Choose a custom log.';
  end if;

  return new;
end;
$$;
