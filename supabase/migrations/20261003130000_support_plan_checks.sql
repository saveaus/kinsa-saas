-- A check against an accepted support plan. A draft does not count until a person accepts it.
-- drafted_by is person today. An assistant can insert a draft later without a schema change.

create type public.support_plan_check_status as enum ('draft', 'accepted');

create table public.support_plan_checks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete restrict,
  plan_id uuid not null references public.participant_records (id) on delete restrict,
  note text not null check (char_length(trim(note)) between 1 and 160),
  checked_on date not null,
  followed boolean not null,
  status public.support_plan_check_status not null default 'draft',
  storage_path text,
  original_filename text,
  mime_type text,
  file_size_bytes integer,
  drafted_by text not null default 'person' check (drafted_by in ('person', 'assistant')),
  created_by uuid references public.users (id),
  accepted_by uuid references public.users (id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_plan_checks_acceptance_check check (
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
  ),
  constraint support_plan_checks_file_check check (
    (
      storage_path is null
      and original_filename is null
      and mime_type is null
      and file_size_bytes is null
    )
    or (
      storage_path is not null
      and original_filename is not null
      and mime_type is not null
      and file_size_bytes is not null
      and file_size_bytes > 0
      and file_size_bytes <= 10485760
    )
  )
);

create index support_plan_checks_organisation_id_idx
  on public.support_plan_checks (organisation_id);

create index support_plan_checks_participant_id_idx
  on public.support_plan_checks (participant_id);

create index support_plan_checks_plan_id_idx
  on public.support_plan_checks (plan_id);

create trigger support_plan_checks_set_updated_at
  before update on public.support_plan_checks
  for each row execute function private.set_updated_at();

create or replace function private.support_plan_check_matches_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.participant_records
    where id = new.plan_id
      and organisation_id = new.organisation_id
      and participant_id = new.participant_id
      and kind = 'support_plan'
      and status = 'accepted'
  ) then
    raise exception 'Choose an accepted support plan for this participant.';
  end if;
  return new;
end;
$$;

revoke all on function private.support_plan_check_matches_plan() from public, anon;
grant execute on function private.support_plan_check_matches_plan() to authenticated, service_role;

create trigger support_plan_checks_plan
  before insert or update on public.support_plan_checks
  for each row execute function private.support_plan_check_matches_plan();

alter table public.support_plan_checks enable row level security;

create policy support_plan_checks_select on public.support_plan_checks
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy support_plan_checks_insert on public.support_plan_checks
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and created_by = auth.uid()
    and exists (
      select 1
      from public.participants
      where participants.id = participant_id
        and participants.organisation_id = support_plan_checks.organisation_id
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

create policy support_plan_checks_update on public.support_plan_checks
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

create policy support_plan_checks_delete on public.support_plan_checks
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and status = 'draft'
  );

grant select, insert, update, delete on public.support_plan_checks to authenticated, service_role;

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
    and not exists (
      select 1
      from public.support_plan_checks
      where support_plan_checks.participant_id = participants.id
        and support_plan_checks.status = 'accepted'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'support-plan-checks',
  'support-plan-checks',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy support_plan_checks_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'support-plan-checks'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy support_plan_checks_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'support-plan-checks'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy support_plan_checks_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'support-plan-checks'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );
