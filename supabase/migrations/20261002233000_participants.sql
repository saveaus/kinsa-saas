-- Participants, plus the service agreement and support plan on each person.
-- A draft file does not count until a person accepts it.
-- drafted_by is person today. An assistant can insert a draft later without a schema change.

create type public.participant_record_kind as enum ('service_agreement', 'support_plan');

create type public.participant_record_status as enum ('draft', 'accepted');

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  ndis_number text not null check (ndis_number ~ '^\d{9}$'),
  active boolean not null default true,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index participants_organisation_ndis_number_idx
  on public.participants (organisation_id, ndis_number);

create index participants_organisation_id_idx on public.participants (organisation_id);

create trigger participants_set_updated_at
  before update on public.participants
  for each row execute function private.set_updated_at();

create table public.participant_records (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  kind public.participant_record_kind not null,
  starts_on date,
  ends_on date,
  review_on date,
  status public.participant_record_status not null default 'draft',
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
  constraint participant_records_dates_check check (
    (
      kind = 'service_agreement'
      and starts_on is not null
      and ends_on is not null
      and ends_on >= starts_on
      and review_on is null
    )
    or (
      kind = 'support_plan'
      and review_on is not null
      and starts_on is null
      and ends_on is null
    )
  ),
  constraint participant_records_acceptance_check check (
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

create index participant_records_participant_id_idx
  on public.participant_records (participant_id);

create index participant_records_organisation_id_idx
  on public.participant_records (organisation_id);

create trigger participant_records_set_updated_at
  before update on public.participant_records
  for each row execute function private.set_updated_at();

alter table public.participants enable row level security;
alter table public.participant_records enable row level security;

create policy participants_select on public.participants
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy participants_insert on public.participants
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and created_by = auth.uid()
  );

create policy participants_update on public.participants
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

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
  );

create policy participant_records_select on public.participant_records
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy participant_records_insert on public.participant_records
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and created_by = auth.uid()
    and exists (
      select 1
      from public.participants
      where participants.id = participant_id
        and participants.organisation_id = participant_records.organisation_id
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

create policy participant_records_update on public.participant_records
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

create policy participant_records_delete on public.participant_records
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and status = 'draft'
  );

grant select, insert, update, delete on public.participants to authenticated, service_role;
grant select, insert, update, delete on public.participant_records to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'participants',
  'participants',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy participants_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'participants'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy participants_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'participants'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy participants_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'participants'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );
