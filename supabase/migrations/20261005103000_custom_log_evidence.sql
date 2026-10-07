-- A log can carry an emoji, the evidence it counts toward, and extra date
-- fields. An entry can attach several people and several files.

alter table public.log_registers
  add column emoji text not null default '📋',
  add column evidence_area text,
  add column date_fields jsonb not null default '[]'::jsonb;

alter table public.log_registers
  add constraint log_registers_emoji_check check (char_length(emoji) between 1 and 16),
  add constraint log_registers_evidence_area_check check (
    evidence_area is null
    or evidence_area in (
      'incident',
      'complaint',
      'risk',
      'restrictive_practice',
      'finance',
      'other'
    )
  ),
  add constraint log_registers_date_fields_check check (jsonb_typeof(date_fields) = 'array');

update public.log_registers
set emoji = '⚠️', evidence_area = 'incident'
where built_in = 'incident';

update public.log_registers
set emoji = '📣', evidence_area = 'complaint'
where built_in = 'complaint';

update public.log_registers
set emoji = '🛡️', evidence_area = 'risk'
where built_in = 'risk';

update public.log_registers
set emoji = '🔒', evidence_area = 'restrictive_practice'
where built_in = 'restrictive_practice';

create table public.log_entry_people (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  entry_id uuid not null references public.log_entries (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete restrict,
  worker_id uuid references public.workers (id) on delete restrict,
  constraint log_entry_people_one check (
    (
      participant_id is not null
      and worker_id is null
    )
    or (
      participant_id is null
      and worker_id is not null
    )
  )
);

create index log_entry_people_entry_id_idx on public.log_entry_people (entry_id);
create index log_entry_people_organisation_id_idx on public.log_entry_people (organisation_id);

create table public.log_entry_files (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  entry_id uuid not null references public.log_entries (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes integer not null check (
    file_size_bytes > 0
    and file_size_bytes <= 10485760
  )
);

create index log_entry_files_entry_id_idx on public.log_entry_files (entry_id);

create table public.log_entry_dates (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  entry_id uuid not null references public.log_entries (id) on delete cascade,
  field_id text not null,
  label text not null,
  occurred_on date not null
);

create index log_entry_dates_entry_id_idx on public.log_entry_dates (entry_id);

alter table public.log_entry_people enable row level security;
alter table public.log_entry_files enable row level security;
alter table public.log_entry_dates enable row level security;

create policy log_entry_people_select on public.log_entry_people
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entry_people_insert on public.log_entry_people
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entry_people_delete on public.log_entry_people
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entry_files_select on public.log_entry_files
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entry_files_insert on public.log_entry_files
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entry_files_delete on public.log_entry_files
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entry_dates_select on public.log_entry_dates
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entry_dates_insert on public.log_entry_dates
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_entry_dates_delete on public.log_entry_dates
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

grant select, insert, delete on public.log_entry_people to authenticated, service_role;
grant select, insert, delete on public.log_entry_files to authenticated, service_role;
grant select, insert, delete on public.log_entry_dates to authenticated, service_role;
