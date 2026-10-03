-- Organisation policies. A draft does not count until a person accepts it.
-- drafted_by is person today. An assistant can insert a draft later without a schema change.

create type public.policy_record_status as enum ('draft', 'accepted');

create table public.policies (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  standard_code text not null check (char_length(standard_code) between 1 and 80),
  review_on date not null,
  status public.policy_record_status not null default 'draft',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  drafted_by text not null default 'person' check (drafted_by in ('person', 'assistant')),
  created_by uuid references public.users (id),
  accepted_by uuid references public.users (id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint policies_acceptance_check check (
    (
      status = 'draft'
      and accepted_by is null
      and accepted_at is null
    )
    or (
      status = 'accepted'
      and accepted_by is not null
      and accepted_at is not null
    )
  )
);

create index policies_organisation_id_idx on public.policies (organisation_id);

create trigger policies_set_updated_at
  before update on public.policies
  for each row execute function private.set_updated_at();

alter table public.policies enable row level security;

create policy policies_select on public.policies
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy policies_insert on public.policies
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and created_by = auth.uid()
    and (
      (
        status = 'draft'
        and accepted_by is null
        and accepted_at is null
      )
      or (
        status = 'accepted'
        and accepted_by = auth.uid()
        and accepted_at is not null
      )
    )
  );

create policy policies_update on public.policies
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and status = 'draft'
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and status = 'accepted'
    and accepted_by = auth.uid()
    and accepted_at is not null
  );

create policy policies_delete on public.policies
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and status = 'draft'
  );

grant select, insert, update, delete on public.policies to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'policies',
  'policies',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy policies_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'policies'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy policies_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'policies'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy policies_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'policies'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );
