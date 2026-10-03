-- Qualification and right to work apply to the people who deliver or lead
-- support. Immunisation applies to direct support. Vehicle insurance,
-- registration, and AHPRA stay available and unscored until a role is ticked.

insert into public.document_type_versions (code, name, description, requires_expiry, effective_from)
values
  (
    'qualification',
    'Qualification',
    'Certificate or qualification for the role, such as a Certificate III or IV in Individual Support',
    false,
    '2024-01-01'
  ),
  (
    'right_to_work',
    'Right to work',
    'Evidence of the right to work in Australia',
    true,
    '2024-01-01'
  ),
  (
    'immunisation',
    'Immunisation',
    'Immunisation record required for the role',
    true,
    '2024-01-01'
  ),
  (
    'vehicle_insurance',
    'Vehicle insurance',
    'Current insurance for a vehicle used for work',
    true,
    '2024-01-01'
  ),
  (
    'vehicle_registration',
    'Vehicle registration',
    'Current registration for a vehicle used for work',
    true,
    '2024-01-01'
  ),
  (
    'ahpra',
    'AHPRA registration',
    'Current AHPRA registration for a registered health practitioner',
    true,
    '2024-01-01'
  );

insert into public.organisation_document_types (organisation_id, document_type_version_id, required)
select
  organisations.id,
  document_type_versions.id,
  document_type_versions.code not in ('vehicle_insurance', 'vehicle_registration', 'ahpra')
from public.organisations
cross join public.document_type_versions
where document_type_versions.code in (
  'qualification',
  'right_to_work',
  'immunisation',
  'vehicle_insurance',
  'vehicle_registration',
  'ahpra'
)
on conflict do nothing;

insert into public.document_role_requirements (organisation_id, document_type_version_id, staff_role)
select organisation_document_types.organisation_id, document_type_versions.id, role.staff_role
from public.document_type_versions
join public.organisation_document_types
  on organisation_document_types.document_type_version_id = document_type_versions.id
cross join lateral (
  select unnest(
    case document_type_versions.code
      when 'qualification' then array['support', 'complex_care', 'leader']::public.staff_role[]
      when 'right_to_work' then array['support', 'complex_care', 'leader', 'office']::public.staff_role[]
      when 'immunisation' then array['support', 'complex_care']::public.staff_role[]
      else array[]::public.staff_role[]
    end
  ) as staff_role
) as role
where document_type_versions.code in (
  'qualification',
  'right_to_work',
  'immunisation',
  'vehicle_insurance',
  'vehicle_registration',
  'ahpra'
)
on conflict do nothing;

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
    dtv.code not in ('vehicle_insurance', 'vehicle_registration', 'ahpra')
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
        when 'qualification' then array['support', 'complex_care', 'leader']::public.staff_role[]
        when 'right_to_work' then array['support', 'complex_care', 'leader', 'office']::public.staff_role[]
        when 'immunisation' then array['support', 'complex_care']::public.staff_role[]
        else array[]::public.staff_role[]
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
