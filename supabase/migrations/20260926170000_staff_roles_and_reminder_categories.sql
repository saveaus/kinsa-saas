create type public.staff_role as enum ('support', 'complex_care', 'leader', 'office');

create type public.reminder_category as enum ('documents', 'courses');

alter table public.workers
  add column staff_roles public.staff_role[] not null default '{support}';

alter table public.workers
  add constraint workers_staff_roles_not_empty check (cardinality(staff_roles) > 0);

create table public.course_role_requirements (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  staff_role public.staff_role not null,
  primary key (course_id, staff_role)
);

create table public.document_role_requirements (
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  document_type_version_id uuid not null references public.document_type_versions (id),
  staff_role public.staff_role not null,
  primary key (organisation_id, document_type_version_id, staff_role)
);

alter table public.course_role_requirements enable row level security;
alter table public.document_role_requirements enable row level security;

grant select, insert, update, delete on public.course_role_requirements to authenticated, service_role;
grant select, insert, update, delete on public.document_role_requirements to authenticated, service_role;

create policy course_role_requirements_select on public.course_role_requirements
  for select to authenticated
  using (organisation_id in (select private.user_organisation_ids()));

create policy course_role_requirements_write on public.course_role_requirements
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  );

create policy document_role_requirements_select on public.document_role_requirements
  for select to authenticated
  using (organisation_id in (select private.user_organisation_ids()));

create policy document_role_requirements_write on public.document_role_requirements
  for all to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

insert into public.course_role_requirements (organisation_id, course_id, staff_role)
select courses.organisation_id, courses.id, role.staff_role
from public.courses
cross join lateral (
  select unnest(
    case
      when courses.code like 'CC-%' then array['complex_care']::public.staff_role[]
      when courses.audience ilike '%office-based%' then array['office']::public.staff_role[]
      when courses.audience ilike '%all staff%' then array['support', 'complex_care', 'leader', 'office']::public.staff_role[]
      when courses.audience ilike '%finance%' then array['support', 'complex_care', 'office']::public.staff_role[]
      when courses.audience ilike '%intake%' then array['leader', 'office']::public.staff_role[]
      when courses.audience ilike '%sil%' then array['support', 'complex_care', 'leader']::public.staff_role[]
      when courses.audience ilike '%leader%' and courses.audience ilike '%support%' then array['support', 'complex_care', 'leader']::public.staff_role[]
      when courses.audience ilike '%leader%' or courses.audience ilike '%governance%' then array['leader']::public.staff_role[]
      when courses.audience ilike '%support%'
        or courses.audience ilike '%epilepsy%'
        or courses.audience ilike '%medication%'
        or courses.audience ilike '%role-specific%'
        then array['support', 'complex_care']::public.staff_role[]
      else array['support', 'complex_care', 'leader', 'office']::public.staff_role[]
    end
  ) as staff_role
) as role
where courses.required = true
on conflict do nothing;

insert into public.document_role_requirements (organisation_id, document_type_version_id, staff_role)
select organisation_document_types.organisation_id, document_type_versions.id, role.staff_role
from public.document_type_versions
join public.organisation_document_types
  on organisation_document_types.document_type_version_id = document_type_versions.id
cross join lateral (
  select unnest(
    case document_type_versions.code
      when 'ndis_orientation' then array['support', 'complex_care', 'leader', 'office']::public.staff_role[]
      when 'ndis_worker_screening' then array['support', 'complex_care', 'leader']::public.staff_role[]
      when 'wwcc' then array['support', 'complex_care']::public.staff_role[]
      when 'first_aid' then array['support', 'complex_care']::public.staff_role[]
      when 'cpr' then array['support', 'complex_care']::public.staff_role[]
      when 'driver_licence' then array['support', 'complex_care']::public.staff_role[]
      when 'police_check' then array['support', 'complex_care']::public.staff_role[]
      when 'practical_competency' then array['complex_care']::public.staff_role[]
      else array['support', 'complex_care', 'leader', 'office']::public.staff_role[]
    end
  ) as staff_role
) as role
on conflict do nothing;

update public.organisation_document_types as organisation_type
set required = exists (
  select 1
  from public.document_role_requirements requirement
  where requirement.organisation_id = organisation_type.organisation_id
    and requirement.document_type_version_id = organisation_type.document_type_version_id
);

alter table public.reminder_rules
  add column category public.reminder_category;

update public.reminder_rules
set category = 'documents'
where category is null;

update public.reminder_dispatches as dispatch
set reminder_rule_id = keeper.id
from public.reminder_rules as drop_rule
join public.reminder_rules as keeper
  on keeper.organisation_id = drop_rule.organisation_id
 and keeper.days_before = drop_rule.days_before
 and keeper.subject = drop_rule.subject
 and keeper.body_template = drop_rule.body_template
 and keeper.id < drop_rule.id
where dispatch.reminder_rule_id = drop_rule.id;

delete from public.reminder_rules as drop_rule
using public.reminder_rules as keeper
where keeper.organisation_id = drop_rule.organisation_id
  and keeper.days_before = drop_rule.days_before
  and keeper.subject = drop_rule.subject
  and keeper.body_template = drop_rule.body_template
  and keeper.id < drop_rule.id;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'reminder_rules'
      and con.contype = 'u'
  loop
    execute format('alter table public.reminder_rules drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.reminder_rules
  drop column document_type_version_id;

alter table public.reminder_rules
  alter column category set not null;

alter table public.reminder_dispatches
  alter column document_id drop not null;

alter table public.reminder_dispatches
  add column enrolment_id uuid references public.enrolments (id) on delete cascade;

alter table public.reminder_dispatches
  add constraint reminder_dispatches_target_check check (
    (document_id is not null and enrolment_id is null)
    or (document_id is null and enrolment_id is not null)
  );

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'reminder_dispatches'
      and con.contype = 'u'
  loop
    execute format('alter table public.reminder_dispatches drop constraint %I', constraint_name);
  end loop;
end $$;

create unique index reminder_dispatches_document_rule_due_idx
  on public.reminder_dispatches (document_id, reminder_rule_id, due_on)
  where document_id is not null;

create unique index reminder_dispatches_enrolment_rule_due_idx
  on public.reminder_dispatches (enrolment_id, reminder_rule_id, due_on)
  where enrolment_id is not null;

insert into public.reminder_rules (organisation_id, category, days_before, subject, body_template)
select
  organisations.id,
  'courses'::public.reminder_category,
  follow_up.days_before,
  follow_up.subject,
  follow_up.body_template
from public.organisations
cross join (
  values
    (
      90,
      'Your {{course_name}} renews in 90 days',
      'Hello {{worker_name}}, your {{course_name}} for {{organisation_name}} needs to be completed again by {{expiry_date}}.'
    ),
    (
      30,
      'Your {{course_name}} renews in 30 days',
      'Hello {{worker_name}}, your {{course_name}} for {{organisation_name}} needs to be completed again by {{expiry_date}}. Please finish the renewal soon.'
    ),
    (
      7,
      'Your {{course_name}} renews in 7 days',
      'Hello {{worker_name}}, your {{course_name}} for {{organisation_name}} needs to be completed again by {{expiry_date}}. This is now urgent.'
    )
) as follow_up(days_before, subject, body_template);

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

  insert into public.document_role_requirements (organisation_id, document_type_version_id, staff_role)
  select p_organisation_id, dtv.id, role.staff_role
  from public.document_type_versions dtv
  cross join lateral (
    select unnest(
      case dtv.code
        when 'ndis_orientation' then array['support', 'complex_care', 'leader', 'office']::public.staff_role[]
        when 'ndis_worker_screening' then array['support', 'complex_care', 'leader']::public.staff_role[]
        when 'wwcc' then array['support', 'complex_care']::public.staff_role[]
        when 'first_aid' then array['support', 'complex_care']::public.staff_role[]
        when 'cpr' then array['support', 'complex_care']::public.staff_role[]
        when 'driver_licence' then array['support', 'complex_care']::public.staff_role[]
        when 'police_check' then array['support', 'complex_care']::public.staff_role[]
        when 'practical_competency' then array['complex_care']::public.staff_role[]
        else array['support', 'complex_care', 'leader', 'office']::public.staff_role[]
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
