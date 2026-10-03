-- Organisation logs. Built-in registers can be hidden. A custom log is either
-- in the sidebar, or attached to one participant or worker.

create table public.log_registers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  visible boolean not null default true,
  scope text not null check (scope in ('global', 'person')),
  subject text not null check (subject in ('organisation', 'participant', 'worker')),
  participant_id uuid references public.participants (id) on delete restrict,
  worker_id uuid references public.workers (id) on delete restrict,
  built_in text check (
    built_in in (
      'incident',
      'complaint',
      'risk',
      'restrictive_practice',
      'support_plan_check'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, slug),
  unique (organisation_id, built_in),
  constraint log_registers_scope_check check (
    (
      scope = 'global'
      and participant_id is null
      and worker_id is null
    )
    or (
      scope = 'person'
      and subject = 'participant'
      and participant_id is not null
      and worker_id is null
      and built_in is null
    )
    or (
      scope = 'person'
      and subject = 'worker'
      and worker_id is not null
      and participant_id is null
      and built_in is null
    )
  ),
  constraint log_registers_builtin_check check (
    built_in is null
    or (
      scope = 'global'
      and (
        (
          built_in in ('incident', 'complaint', 'risk')
          and subject = 'organisation'
        )
        or (
          built_in in ('restrictive_practice', 'support_plan_check')
          and subject = 'participant'
        )
      )
    )
  )
);

create index log_registers_organisation_id_idx on public.log_registers (organisation_id);

create trigger log_registers_set_updated_at
  before update on public.log_registers
  for each row execute function private.set_updated_at();

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  register_id uuid not null references public.log_registers (id) on delete restrict,
  summary text not null check (char_length(trim(summary)) between 1 and 160),
  occurred_on date not null,
  participant_id uuid references public.participants (id) on delete restrict,
  worker_id uuid references public.workers (id) on delete restrict,
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
  constraint log_entries_acceptance_check check (
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
  constraint log_entries_person_check check (
    participant_id is null or worker_id is null
  )
);

create index log_entries_organisation_id_idx on public.log_entries (organisation_id);
create index log_entries_register_id_idx on public.log_entries (register_id);
create index log_entries_participant_id_idx on public.log_entries (participant_id);
create index log_entries_worker_id_idx on public.log_entries (worker_id);

create trigger log_entries_set_updated_at
  before update on public.log_entries
  for each row execute function private.set_updated_at();

create or replace function private.log_entry_matches_register()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  reg public.log_registers;
begin
  select * into reg
  from public.log_registers
  where id = new.register_id
    and organisation_id = new.organisation_id;

  if reg.id is null or reg.built_in is not null then
    raise exception 'Choose a custom log.';
  end if;

  if reg.subject = 'participant' then
    if new.participant_id is null or new.worker_id is not null then
      raise exception 'Choose the participant this is about.';
    end if;
    if reg.participant_id is not null and new.participant_id is distinct from reg.participant_id then
      raise exception 'This log belongs to a different participant.';
    end if;
  elsif reg.subject = 'worker' then
    if new.worker_id is null or new.participant_id is not null then
      raise exception 'Choose the worker this is about.';
    end if;
    if reg.worker_id is not null and new.worker_id is distinct from reg.worker_id then
      raise exception 'This log belongs to a different worker.';
    end if;
  elsif reg.subject = 'organisation' then
    if new.worker_id is not null then
      raise exception 'This log is not about a worker.';
    end if;
  else
    raise exception 'Choose what this log is about.';
  end if;

  return new;
end;
$$;

revoke all on function private.log_entry_matches_register() from public, anon;
grant execute on function private.log_entry_matches_register() to authenticated, service_role;

create trigger log_entries_register
  before insert or update on public.log_entries
  for each row execute function private.log_entry_matches_register();

create or replace function private.seed_log_registers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.log_registers (
    organisation_id, name, slug, visible, scope, subject, built_in
  )
  values
    (new.id, 'Incidents', 'incidents', true, 'global', 'organisation', 'incident'),
    (new.id, 'Complaints', 'complaints', true, 'global', 'organisation', 'complaint'),
    (new.id, 'Risks', 'risks', true, 'global', 'organisation', 'risk'),
    (new.id, 'Restrictive practices', 'restrictive-practices', true, 'global', 'participant', 'restrictive_practice'),
    (new.id, 'Support plan checks', 'support-plan-checks', true, 'global', 'participant', 'support_plan_check')
  on conflict (organisation_id, built_in) do nothing;
  return new;
end;
$$;

revoke all on function private.seed_log_registers() from public, anon, authenticated;
grant execute on function private.seed_log_registers() to service_role;

create trigger organisations_seed_log_registers
  after insert on public.organisations
  for each row execute function private.seed_log_registers();

insert into public.log_registers (
  organisation_id, name, slug, visible, scope, subject, built_in
)
select organisations.id, seeded.name, seeded.slug, true, 'global', seeded.subject, seeded.built_in
from public.organisations
cross join (
  values
    ('Incidents', 'incidents', 'organisation', 'incident'),
    ('Complaints', 'complaints', 'organisation', 'complaint'),
    ('Risks', 'risks', 'organisation', 'risk'),
    ('Restrictive practices', 'restrictive-practices', 'participant', 'restrictive_practice'),
    ('Support plan checks', 'support-plan-checks', 'participant', 'support_plan_check')
) as seeded (name, slug, subject, built_in)
on conflict (organisation_id, built_in) do nothing;

alter table public.log_registers enable row level security;
alter table public.log_entries enable row level security;

create policy log_registers_select on public.log_registers
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_registers_insert on public.log_registers
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and built_in is null
  );

create policy log_registers_update on public.log_registers
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_registers_delete on public.log_registers
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and built_in is null
    and not exists (
      select 1
      from public.log_entries
      where log_entries.register_id = log_registers.id
        and log_entries.status = 'accepted'
    )
  );

create policy log_entries_select on public.log_entries
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entries_insert on public.log_entries
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

create policy log_entries_update on public.log_entries
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

create policy log_entries_delete on public.log_entries
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and status = 'draft'
  );

grant select, insert, update, delete on public.log_registers to authenticated, service_role;
grant select, insert, update, delete on public.log_entries to authenticated, service_role;

drop policy participants_delete on public.participants;

create policy participants_delete on public.participants
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and not exists (
      select 1 from public.participant_records
      where participant_records.participant_id = participants.id
        and participant_records.status = 'accepted'
    )
    and not exists (
      select 1 from public.incidents
      where incidents.participant_id = participants.id
        and incidents.status = 'accepted'
    )
    and not exists (
      select 1 from public.support_plan_checks
      where support_plan_checks.participant_id = participants.id
        and support_plan_checks.status = 'accepted'
    )
    and not exists (
      select 1 from public.log_entries
      where log_entries.participant_id = participants.id
        and log_entries.status = 'accepted'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logs',
  'logs',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy logs_storage_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'logs'
    and (storage.foldername(name))[1] in (select private.user_organisation_ids()::text)
    and private.user_has_permission('settings.manage')
  );

create policy logs_storage_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'logs'
    and (storage.foldername(name))[1] in (select private.user_organisation_ids()::text)
    and private.user_has_permission('settings.manage')
  );

create policy logs_storage_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'logs'
    and (storage.foldername(name))[1] in (select private.user_organisation_ids()::text)
    and private.user_has_permission('settings.manage')
  );
