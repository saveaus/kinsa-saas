-- A file sits in a policy folder. Policies are added into that file.

create table public.policy_files (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  category text not null,
  name text not null check (char_length(trim(name)) between 1 and 160),
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policy_files_category_check check (
    category in ('all', 'core', 'verification', 'implementing')
    or category ~ '^[0-9]{4}$'
  )
);

create index policy_files_organisation_id_idx on public.policy_files (organisation_id);

create unique index policy_files_organisation_category_name_uidx
  on public.policy_files (organisation_id, category, lower(name));

create trigger policy_files_set_updated_at
  before update on public.policy_files
  for each row execute function private.set_updated_at();

alter table public.policy_files enable row level security;

create policy policy_files_select on public.policy_files
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy policy_files_insert on public.policy_files
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and created_by = auth.uid()
  );

grant select, insert on public.policy_files to authenticated;
grant select, insert, update, delete on public.policy_files to service_role;

alter table public.policies
  add column file_id uuid references public.policy_files (id) on delete restrict;

create index policies_file_id_idx on public.policies (file_id);

create or replace function private.policies_file_matches()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  file_organisation uuid;
  file_category text;
begin
  if new.file_id is null then
    return new;
  end if;

  select organisation_id, category
    into file_organisation, file_category
  from public.policy_files
  where id = new.file_id;

  if file_organisation is distinct from new.organisation_id
     or file_category is distinct from new.category then
    raise exception 'Policy file does not match this policy';
  end if;

  return new;
end;
$$;

revoke all on function private.policies_file_matches() from public, anon, authenticated;

create trigger policies_file_matches
  before insert or update on public.policies
  for each row execute function private.policies_file_matches();
