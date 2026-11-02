-- The course removal left both organisation seeds naming retired values:
-- 'courses'::reminder_category made create_organisation fail for every new
-- provider, and new teams were still granted courses.take.

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
  select teams.id, 'documents.upload_own'::public.app_permission
  from public.teams
  where teams.organisation_id = p_organisation_id
    and teams.built_in
  on conflict do nothing;
end;
$$;

revoke all on function private.seed_organisation_teams(uuid) from public, anon, authenticated;

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
      )
  ) as follow_up(category, days_before, subject, body_template);
end;
$$;


-- Every dispatch now points at a document, since the enrolment target is gone.
alter table public.reminder_dispatches
  alter column document_id set not null;
