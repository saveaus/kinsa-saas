-- V1 foundations: tenancy, identity, permissions, compliance objects, RLS.
-- Privileged helpers live in private. All public tables have RLS.

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to postgres, service_role, supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'worker');

create type public.app_permission as enum (
  'workers.manage',
  'workers.read_all',
  'documents.approve',
  'documents.upload_own',
  'documents.read_all',
  'courses.manage',
  'courses.take',
  'reminders.manage',
  'reports.export',
  'audit.read',
  'settings.manage'
);

create type public.document_approval_status as enum ('pending', 'approved', 'rejected');
create type public.worker_employment_status as enum ('active', 'inactive');
create type public.course_publication_status as enum ('draft', 'published');
create type public.enrolment_status as enum ('assigned', 'in_progress', 'completed');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create index memberships_organisation_id_idx on public.memberships (organisation_id);

create table public.role_permissions (
  role public.app_role not null,
  permission public.app_permission not null,
  primary key (role, permission)
);

create table public.workers (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid unique references public.users (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  employment_status public.worker_employment_status not null default 'active',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workers_organisation_id_idx on public.workers (organisation_id);
create unique index workers_org_email_active_idx
  on public.workers (organisation_id, lower(email))
  where deleted_at is null;

create table public.document_type_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  requires_expiry boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (code, effective_from)
);

create table public.organisation_document_types (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  document_type_version_id uuid not null references public.document_type_versions (id),
  required boolean not null default true,
  primary key (organisation_id, document_type_version_id)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  document_type_version_id uuid not null references public.document_type_versions (id),
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  expires_on date,
  approval_status public.document_approval_status not null default 'pending',
  review_note text,
  reviewed_by uuid references public.users (id),
  reviewed_at timestamptz,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_organisation_id_idx on public.documents (organisation_id);
create index documents_worker_id_idx on public.documents (worker_id);
create index documents_approval_status_idx on public.documents (organisation_id, approval_status);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  title text not null,
  description text,
  status public.course_publication_status not null default 'draft',
  pass_mark integer not null default 80 check (pass_mark between 0 and 100),
  required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_organisation_id_idx on public.courses (organisation_id);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  body_markdown text not null default '',
  sort_order integer not null default 0,
  quiz jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index course_modules_course_id_idx on public.course_modules (course_id);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  status public.enrolment_status not null default 'assigned',
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (course_id, worker_id)
);

create index enrolments_worker_id_idx on public.enrolments (worker_id);

create table public.completions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  enrolment_id uuid not null references public.enrolments (id) on delete cascade,
  course_module_id uuid not null references public.course_modules (id) on delete cascade,
  passed boolean not null,
  score integer,
  answers jsonb,
  completed_at timestamptz not null default now(),
  unique (enrolment_id, course_module_id)
);

create table public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  document_type_version_id uuid not null references public.document_type_versions (id),
  days_before integer not null check (days_before >= 0 and days_before <= 365),
  subject text not null,
  body_template text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, document_type_version_id, days_before)
);

create table public.reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  reminder_rule_id uuid not null references public.reminder_rules (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  due_on date not null,
  sent_at timestamptz not null default now(),
  unique (document_id, reminder_rule_id, due_on)
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  actor_user_id uuid,
  actor_role public.app_role,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_organisation_created_idx
  on public.audit_events (organisation_id, created_at desc);

create table public.document_access_events (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  actor_user_id uuid,
  action text not null default 'view',
  created_at timestamptz not null default now()
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table private.rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  hit_count integer not null
);

-- ---------------------------------------------------------------------------
-- Seed reference data and permissions
-- ---------------------------------------------------------------------------

insert into public.role_permissions (role, permission)
values
  ('admin', 'workers.manage'),
  ('admin', 'workers.read_all'),
  ('admin', 'documents.approve'),
  ('admin', 'documents.upload_own'),
  ('admin', 'documents.read_all'),
  ('admin', 'courses.manage'),
  ('admin', 'courses.take'),
  ('admin', 'reminders.manage'),
  ('admin', 'reports.export'),
  ('admin', 'audit.read'),
  ('admin', 'settings.manage'),
  ('worker', 'documents.upload_own'),
  ('worker', 'courses.take');

insert into public.document_type_versions (code, name, description, requires_expiry, effective_from)
values
  ('ndis_worker_screening', 'NDIS Worker Screening Check', 'Current NDIS Worker Screening clearance', true, '2024-01-01'),
  ('wwcc', 'Working with Children Check', 'State or territory WWCC or equivalent', true, '2024-01-01'),
  ('first_aid', 'First Aid', 'HLTAID011 or current equivalent', true, '2024-01-01'),
  ('cpr', 'CPR', 'HLTAID009 or current equivalent', true, '2024-01-01'),
  ('driver_licence', 'Driver licence', 'Current Australian driver licence if required for the role', true, '2024-01-01'),
  ('police_check', 'National Police Check', 'Current national police certificate', true, '2024-01-01');

-- ---------------------------------------------------------------------------
-- Helper functions (private)
-- ---------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.user_organisation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organisation_id
  from public.memberships m
  where m.user_id = auth.uid();
$$;

create or replace function private.user_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  where m.user_id = auth.uid()
  limit 1;
$$;

create or replace function private.user_worker_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select w.id
  from public.workers w
  where w.user_id = auth.uid()
    and w.deleted_at is null
  limit 1;
$$;

create or replace function private.user_has_permission(requested public.app_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp
      on rp.role = m.role
    where m.user_id = auth.uid()
      and rp.permission = requested
  );
$$;

create or replace function private.write_audit(
  p_organisation_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_events (
    organisation_id,
    actor_user_id,
    actor_role,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    p_organisation_id,
    auth.uid(),
    private.user_role(),
    p_action,
    p_target_type,
    p_target_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.sync_auth_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'organisation_id', new.organisation_id,
      'role', new.role
    )
  where id = new.user_id;
  return new;
end;
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', ''), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.users.full_name);
  return new;
end;
$$;

create or replace function private.seed_organisation_defaults(p_organisation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organisation_document_types (organisation_id, document_type_version_id, required)
  select
    p_organisation_id,
    dtv.id,
    true
  from public.document_type_versions dtv
  where dtv.effective_to is null
  on conflict do nothing;

  insert into public.reminder_rules (
    organisation_id,
    document_type_version_id,
    days_before,
    subject,
    body_template
  )
  select
    p_organisation_id,
    dtv.id,
    offsets.days_before,
    offsets.subject,
    offsets.body_template
  from public.document_type_versions dtv
  cross join (
    values
      (
        90,
        'Your {{document_type}} expires in 90 days',
        'Hello {{worker_name}}, your {{document_type}} for {{organisation_name}} expires on {{expiry_date}}. Please upload a current copy so you stay ready for evidence requests.'
      ),
      (
        30,
        'Your {{document_type}} expires in 30 days',
        'Hello {{worker_name}}, your {{document_type}} for {{organisation_name}} expires on {{expiry_date}}. Please upload a current copy as soon as you can.'
      ),
      (
        7,
        'Your {{document_type}} expires in 7 days',
        'Hello {{worker_name}}, your {{document_type}} for {{organisation_name}} expires on {{expiry_date}}. This is now urgent — please upload a current copy.'
      )
  ) as offsets(days_before, subject, body_template)
  where dtv.effective_to is null
    and dtv.requires_expiry = true
  on conflict do nothing;
end;
$$;

create or replace function public.create_organisation(org_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.memberships m where m.user_id = auth.uid()) then
    raise exception 'already a member of an organisation';
  end if;

  if org_name is null or char_length(trim(org_name)) < 1 then
    raise exception 'organisation name is required';
  end if;

  insert into public.organisations (name)
  values (trim(org_name))
  returning id into org_id;

  insert into public.memberships (user_id, organisation_id, role)
  values (auth.uid(), org_id, 'admin');

  perform private.seed_organisation_defaults(org_id);
  perform private.write_audit(org_id, 'organisation.created', 'organisation', org_id, jsonb_build_object('name', trim(org_name)));

  return org_id;
end;
$$;

create or replace function private.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row private.rate_limits%rowtype;
begin
  select * into current_row from private.rate_limits where key = p_key;

  if not found then
    insert into private.rate_limits (key, window_started_at, hit_count)
    values (p_key, now(), 1);
    return true;
  end if;

  if current_row.window_started_at < now() - make_interval(secs => p_window_seconds) then
    update private.rate_limits
    set window_started_at = now(), hit_count = 1
    where key = p_key;
    return true;
  end if;

  if current_row.hit_count >= p_max then
    return false;
  end if;

  update private.rate_limits
  set hit_count = hit_count + 1
  where key = p_key;

  return true;
end;
$$;

create or replace function public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.check_rate_limit(p_key, p_max, p_window_seconds);
$$;

create or replace function public.record_audit(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  select private.user_organisation_ids() into org_id;
  if org_id is null then
    raise exception 'not a member of an organisation';
  end if;
  perform private.write_audit(org_id, p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_events are immutable';
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger organisations_set_updated_at
  before update on public.organisations
  for each row execute function private.set_updated_at();

create trigger users_set_updated_at
  before update on public.users
  for each row execute function private.set_updated_at();

create trigger workers_set_updated_at
  before update on public.workers
  for each row execute function private.set_updated_at();

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function private.set_updated_at();

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function private.set_updated_at();

create trigger course_modules_set_updated_at
  before update on public.course_modules
  for each row execute function private.set_updated_at();

create trigger reminder_rules_set_updated_at
  before update on public.reminder_rules
  for each row execute function private.set_updated_at();

create trigger memberships_sync_app_metadata
  after insert or update on public.memberships
  for each row execute function private.sync_auth_app_metadata();

create trigger audit_events_no_update
  before update on public.audit_events
  for each row execute function private.prevent_audit_mutation();

create trigger audit_events_no_delete
  before delete on public.audit_events
  for each row execute function private.prevent_audit_mutation();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.users enable row level security;
alter table public.memberships enable row level security;
alter table public.role_permissions enable row level security;
alter table public.workers enable row level security;
alter table public.document_type_versions enable row level security;
alter table public.organisation_document_types enable row level security;
alter table public.documents enable row level security;
alter table public.courses enable row level security;
alter table public.course_modules enable row level security;
alter table public.enrolments enable row level security;
alter table public.completions enable row level security;
alter table public.reminder_rules enable row level security;
alter table public.reminder_dispatches enable row level security;
alter table public.audit_events enable row level security;
alter table public.document_access_events enable row level security;
alter table public.invites enable row level security;

-- organisations
create policy organisations_select on public.organisations
  for select to authenticated
  using (id in (select private.user_organisation_ids()));

-- users: self, or same-org admin
create policy users_select_self on public.users
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.memberships mine
      join public.memberships theirs
        on theirs.organisation_id = mine.organisation_id
      where mine.user_id = auth.uid()
        and mine.role = 'admin'
        and theirs.user_id = users.id
    )
  );

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy memberships_select on public.memberships
  for select to authenticated
  using (organisation_id in (select private.user_organisation_ids()));

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (true);

create policy document_type_versions_select on public.document_type_versions
  for select to authenticated
  using (true);

create policy organisation_document_types_select on public.organisation_document_types
  for select to authenticated
  using (organisation_id in (select private.user_organisation_ids()));

create policy organisation_document_types_admin_write on public.organisation_document_types
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

-- workers
create policy workers_select on public.workers
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('workers.read_all')
      or user_id = auth.uid()
    )
  );

create policy workers_admin_write on public.workers
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('workers.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('workers.manage')
  );

-- documents
create policy documents_select on public.documents
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('documents.read_all')
      or worker_id = private.user_worker_id()
    )
  );

create policy documents_insert on public.documents
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('documents.read_all')
      or (
        private.user_has_permission('documents.upload_own')
        and worker_id = private.user_worker_id()
      )
    )
  );

create policy documents_update on public.documents
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('documents.approve')
      or (
        private.user_has_permission('documents.upload_own')
        and worker_id = private.user_worker_id()
        and approval_status = 'pending'
      )
    )
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
  );

create policy documents_delete on public.documents
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('workers.manage')
  );

-- courses
create policy courses_select on public.courses
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('courses.manage')
      or status = 'published'
    )
  );

create policy courses_admin_write on public.courses
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  );

create policy course_modules_select on public.course_modules
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('courses.manage')
      or exists (
        select 1 from public.courses c
        where c.id = course_modules.course_id
          and c.status = 'published'
      )
    )
  );

create policy course_modules_admin_write on public.course_modules
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  );

create policy enrolments_select on public.enrolments
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('courses.manage')
      or worker_id = private.user_worker_id()
    )
  );

create policy enrolments_admin_write on public.enrolments
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  );

create policy enrolments_worker_update on public.enrolments
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and worker_id = private.user_worker_id()
    and private.user_has_permission('courses.take')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and worker_id = private.user_worker_id()
  );

create policy completions_select on public.completions
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('courses.manage')
      or exists (
        select 1 from public.enrolments e
        where e.id = completions.enrolment_id
          and e.worker_id = private.user_worker_id()
      )
    )
  );

create policy completions_insert on public.completions
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('courses.manage')
      or exists (
        select 1 from public.enrolments e
        where e.id = completions.enrolment_id
          and e.worker_id = private.user_worker_id()
      )
    )
  );

create policy reminder_rules_select on public.reminder_rules
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('reminders.manage')
  );

create policy reminder_rules_write on public.reminder_rules
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('reminders.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('reminders.manage')
  );

create policy reminder_dispatches_select on public.reminder_dispatches
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('reminders.manage')
  );

create policy reminder_dispatches_insert on public.reminder_dispatches
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('reminders.manage')
  );

create policy audit_events_select on public.audit_events
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('audit.read')
  );

create policy audit_events_insert on public.audit_events
  for insert to authenticated
  with check (organisation_id in (select private.user_organisation_ids()));

create policy document_access_events_select on public.document_access_events
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('audit.read')
  );

create policy document_access_events_insert on public.document_access_events
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('documents.read_all')
      or exists (
        select 1 from public.documents d
        where d.id = document_access_events.document_id
          and d.worker_id = private.user_worker_id()
      )
    )
  );

create policy invites_select on public.invites
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('workers.manage')
  );

create policy invites_write on public.invites
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('workers.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('workers.manage')
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

grant execute on function public.create_organisation(text) to authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated, anon;
grant execute on function public.record_audit(text, text, uuid, jsonb) to authenticated;

grant execute on function private.user_organisation_ids() to authenticated, service_role;
grant execute on function private.user_role() to authenticated, service_role;
grant execute on function private.user_worker_id() to authenticated, service_role;
grant execute on function private.user_has_permission(public.app_permission) to authenticated, service_role;

grant all on table public.users to supabase_auth_admin;
grant all on table public.memberships to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
