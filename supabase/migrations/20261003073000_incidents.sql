-- Incidents and complaints. A draft does not count until a person accepts it.
-- drafted_by is person today. An assistant can insert a draft later without a schema change.

create type public.incident_kind as enum ('incident', 'complaint');

create type public.incident_status as enum ('draft', 'accepted');

create table public.incidents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  kind public.incident_kind not null,
  summary text not null check (char_length(trim(summary)) between 1 and 160),
  occurred_on date not null,
  participant_id uuid references public.participants (id) on delete restrict,
  status public.incident_status not null default 'draft',
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
  constraint incidents_acceptance_check check (
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

create index incidents_organisation_id_idx on public.incidents (organisation_id);

create index incidents_participant_id_idx on public.incidents (participant_id);

create trigger incidents_set_updated_at
  before update on public.incidents
  for each row execute function private.set_updated_at();

alter table public.incidents enable row level security;

create policy incidents_select on public.incidents
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy incidents_insert on public.incidents
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and created_by = auth.uid()
    and (
      participant_id is null
      or exists (
        select 1
        from public.participants
        where participants.id = participant_id
          and participants.organisation_id = incidents.organisation_id
      )
    )
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

create policy incidents_update on public.incidents
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

create policy incidents_delete on public.incidents
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and status = 'draft'
  );

grant select, insert, update, delete on public.incidents to authenticated, service_role;

drop policy participants_delete on public.participants;

create policy participants_delete on public.participants
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and not exists (
      select 1
      from public.participant_records
      where participant_records.participant_id = participants.id
        and participant_records.status = 'accepted'
    )
    and not exists (
      select 1
      from public.incidents
      where incidents.participant_id = participants.id
        and incidents.status = 'accepted'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'incidents',
  'incidents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy incidents_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'incidents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy incidents_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'incidents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy incidents_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'incidents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );
