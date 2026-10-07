-- Organisation teams. Standard worker types can be renamed. Custom teams
-- are extra codes stored as text on workers and requirement rows.

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  code text not null check (code ~ '^[a-z][a-z0-9_]{0,39}$'),
  built_in boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, code),
  constraint teams_built_in_code check (
    (
      built_in
      and code in ('support', 'complex_care', 'leader', 'office')
    )
    or (
      not built_in
      and code not in ('support', 'complex_care', 'leader', 'office')
    )
  )
);

create unique index teams_org_name_idx
  on public.teams (organisation_id, lower(name));

create index teams_organisation_id_idx on public.teams (organisation_id);

create table public.team_permissions (
  team_id uuid not null references public.teams (id) on delete cascade,
  permission public.app_permission not null,
  primary key (team_id, permission)
);

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function private.set_updated_at();

alter table public.teams enable row level security;
alter table public.team_permissions enable row level security;

revoke all on public.teams from public, anon;
revoke all on public.team_permissions from public, anon;
grant select, insert, update, delete on public.teams to authenticated, service_role;
grant select, insert, update, delete on public.team_permissions to authenticated, service_role;

create policy teams_select on public.teams
  for select to authenticated
  using (organisation_id in (select private.user_organisation_ids()));

create policy teams_write on public.teams
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy team_permissions_select on public.team_permissions
  for select to authenticated
  using (
    exists (
      select 1
      from public.teams
      where teams.id = team_permissions.team_id
        and teams.organisation_id in (select private.user_organisation_ids())
    )
  );

create policy team_permissions_write on public.team_permissions
  for all to authenticated
  using (
    exists (
      select 1
      from public.teams
      where teams.id = team_permissions.team_id
        and teams.organisation_id in (select private.user_organisation_ids())
    )
    and private.user_has_permission('settings.manage')
  )
  with check (
    exists (
      select 1
      from public.teams
      where teams.id = team_permissions.team_id
        and teams.organisation_id in (select private.user_organisation_ids())
    )
    and private.user_has_permission('settings.manage')
  );

create or replace function private.seed_organisation_teams(p_organisation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.teams (organisation_id, name, code, built_in, position)
  select p_organisation_id, team.name, team.code, true, team.position
  from (
    values
      ('Support worker', 'support', 0),
      ('Complex care', 'complex_care', 1),
      ('Leader', 'leader', 2),
      ('Office', 'office', 3)
  ) as team(name, code, position)
  on conflict (organisation_id, code) do nothing;

  insert into public.team_permissions (team_id, permission)
  select teams.id, permission.permission
  from public.teams
  cross join (
    values
      ('documents.upload_own'::public.app_permission),
      ('courses.take'::public.app_permission)
  ) as permission(permission)
  where teams.organisation_id = p_organisation_id
    and teams.built_in
  on conflict do nothing;
end;
$$;

revoke all on function private.seed_organisation_teams(uuid) from public, anon, authenticated;

do $$
declare
  org_id uuid;
begin
  for org_id in select id from public.organisations loop
    perform private.seed_organisation_teams(org_id);
  end loop;
end;
$$;

alter table public.workers alter column staff_roles drop default;
alter table public.workers
  alter column staff_roles type text[] using staff_roles::text[];
alter table public.workers
  alter column staff_roles set default array['support']::text[];

alter table public.document_role_requirements
  alter column staff_role type text using staff_role::text;

alter table public.course_role_requirements
  alter column staff_role type text using staff_role::text;

create or replace function private.seed_organisation_defaults(p_organisation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_organisation_teams(p_organisation_id);

  insert into public.organisation_document_types (organisation_id, document_type_version_id, required)
  select
    p_organisation_id,
    dtv.id,
    dtv.code not in (
      'vehicle_insurance',
      'vehicle_registration',
      'ahpra',
      'practical_competency'
    )
  from public.document_type_versions dtv
  where dtv.effective_to is null
  on conflict do nothing;

  insert into public.document_role_requirements (organisation_id, document_type_version_id, staff_role)
  select p_organisation_id, dtv.id, role.staff_role
  from public.document_type_versions dtv
  cross join lateral (
    select unnest(
      case dtv.code
        when 'ndis_orientation' then array['support', 'complex_care', 'leader', 'office']::text[]
        when 'ndis_worker_screening' then array['support', 'complex_care', 'leader']::text[]
        when 'wwcc' then array['support', 'complex_care']::text[]
        when 'first_aid' then array['support', 'complex_care']::text[]
        when 'cpr' then array['support', 'complex_care']::text[]
        when 'driver_licence' then array['support', 'complex_care']::text[]
        when 'police_check' then array['support', 'complex_care']::text[]
        when 'qualification' then array['support', 'complex_care', 'leader']::text[]
        when 'right_to_work' then array['support', 'complex_care', 'leader', 'office']::text[]
        when 'immunisation' then array['support', 'complex_care']::text[]
        when 'signoff_bowel' then array['complex_care']::text[]
        when 'signoff_enteral' then array['complex_care']::text[]
        when 'signoff_dysphagia' then array['complex_care']::text[]
        when 'signoff_ventilation' then array['complex_care']::text[]
        when 'signoff_tracheostomy' then array['complex_care']::text[]
        when 'signoff_catheter' then array['complex_care']::text[]
        when 'signoff_injection' then array['complex_care']::text[]
        when 'signoff_wound' then array['complex_care']::text[]
        when 'signoff_medication' then array['support', 'complex_care']::text[]
        when 'signoff_manual_handling' then array['support', 'complex_care']::text[]
        when 'signoff_diabetes' then array['complex_care']::text[]
        else array[]::text[]
      end
    ) as staff_role
  ) as role
  where dtv.effective_to is null
  on conflict do nothing;

  insert into public.reminder_rules (organisation_id, category, days_before, subject, body_template)
  select
    p_organisation_id,
    follow_up.category,
    follow_up.days_before,
    follow_up.subject,
    follow_up.body_template
  from (
    values
      (
        'documents'::public.reminder_category,
        90,
        'Your {{document_type}} expires in 90 days',
        'Hello {{worker_name}}, your {{document_type}} for {{organisation_name}} expires on {{expiry_date}}. Please upload a current copy so you stay ready for evidence requests.'
      ),
      (
        'documents'::public.reminder_category,
        30,
        'Your {{document_type}} expires in 30 days',
        'Hello {{worker_name}}, your {{document_type}} for {{organisation_name}} expires on {{expiry_date}}. Please upload a current copy as soon as you can.'
      ),
      (
        'documents'::public.reminder_category,
        7,
        'Your {{document_type}} expires in 7 days',
        'Hello {{worker_name}}, your {{document_type}} for {{organisation_name}} expires on {{expiry_date}}. This is now urgent — please upload a current copy.'
      ),
      (
        'courses'::public.reminder_category,
        90,
        'Your {{course_name}} renews in 90 days',
        'Hello {{worker_name}}, your {{course_name}} for {{organisation_name}} needs to be completed again by {{expiry_date}}.'
      ),
      (
        'courses'::public.reminder_category,
        30,
        'Your {{course_name}} renews in 30 days',
        'Hello {{worker_name}}, your {{course_name}} for {{organisation_name}} needs to be completed again by {{expiry_date}}. Please finish the renewal soon.'
      ),
      (
        'courses'::public.reminder_category,
        7,
        'Your {{course_name}} renews in 7 days',
        'Hello {{worker_name}}, your {{course_name}} for {{organisation_name}} needs to be completed again by {{expiry_date}}. This is now urgent.'
      )
  ) as follow_up(category, days_before, subject, body_template);
end;
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
      and m.role = 'admin'
      and rp.permission = requested
  )
  or exists (
    select 1
    from public.memberships m
    join public.workers w
      on w.user_id = m.user_id
     and w.organisation_id = m.organisation_id
     and w.deleted_at is null
    join public.teams t
      on t.organisation_id = w.organisation_id
     and t.code = any (w.staff_roles)
    join public.team_permissions tp
      on tp.team_id = t.id
     and tp.permission = requested
    where m.user_id = auth.uid()
      and m.role = 'worker'
  )
  or (
    exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.role = 'worker'
    )
    and not exists (
      select 1
      from public.workers w
      join public.teams t
        on t.organisation_id = w.organisation_id
       and t.code = any (w.staff_roles)
      where w.user_id = auth.uid()
        and w.deleted_at is null
    )
    and exists (
      select 1
      from public.memberships m
      join public.role_permissions rp
        on rp.role = m.role
      where m.user_id = auth.uid()
        and m.role = 'worker'
        and rp.permission = requested
    )
  );
$$;
