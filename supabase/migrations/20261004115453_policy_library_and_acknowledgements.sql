-- A library policy is stored as text. An uploaded policy keeps its file.
-- A policy counts as in use once someone acknowledges the accepted version.

alter table public.policies
  add column body text;

alter table public.policies
  alter column storage_path drop not null,
  alter column original_filename drop not null,
  alter column mime_type drop not null,
  alter column file_size_bytes drop not null;

alter table public.policies
  drop constraint policies_file_size_bytes_check;

alter table public.policies
  add constraint policies_evidence_check check (
    (
      body is not null
      and char_length(trim(body)) between 1 and 20000
      and storage_path is null
      and original_filename is null
      and mime_type is null
      and file_size_bytes is null
    )
    or (
      body is null
      and storage_path is not null
      and original_filename is not null
      and mime_type is not null
      and file_size_bytes is not null
      and file_size_bytes > 0
      and file_size_bytes <= 10485760
    )
  );

create table public.policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  policy_id uuid not null references public.policies (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (policy_id, user_id)
);

create index policy_acknowledgements_organisation_id_idx
  on public.policy_acknowledgements (organisation_id);

alter table public.policy_acknowledgements enable row level security;

create policy policy_acknowledgements_select on public.policy_acknowledgements
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy policy_acknowledgements_insert on public.policy_acknowledgements
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and exists (
      select 1
      from public.policies
      where policies.id = policy_id
        and policies.organisation_id = policy_acknowledgements.organisation_id
        and policies.status = 'accepted'
    )
  );

grant select, insert on public.policy_acknowledgements to authenticated;
grant select, insert, update, delete on public.policy_acknowledgements to service_role;
