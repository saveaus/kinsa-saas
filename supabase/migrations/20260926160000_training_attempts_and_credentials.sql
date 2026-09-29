alter table public.completions
  add column attempt_count integer not null default 0 check (attempt_count >= 0);

insert into public.document_type_versions (code, name, description, requires_expiry, effective_from)
values
  (
    'ndis_orientation',
    'NDIS Worker Orientation Module',
    'Completion of the NDIS Commission Worker Orientation Module',
    false,
    '2024-01-01'
  ),
  (
    'practical_competency',
    'Practical competency sign-off',
    'Workplace sign-off for a practical task such as complex care. Theory training in Kinsa does not replace this.',
    true,
    '2024-01-01'
  );

insert into public.organisation_document_types (organisation_id, document_type_version_id, required)
select
  organisations.id,
  document_type_versions.id,
  document_type_versions.code = 'ndis_orientation'
from public.organisations
cross join public.document_type_versions
where document_type_versions.code in ('ndis_orientation', 'practical_competency')
on conflict do nothing;

insert into public.reminder_rules (
  organisation_id,
  document_type_version_id,
  days_before,
  subject,
  body_template
)
select
  organisations.id,
  document_type_versions.id,
  offsets.days_before,
  offsets.subject,
  offsets.body_template
from public.organisations
cross join public.document_type_versions
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
where document_type_versions.code = 'practical_competency'
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
    dtv.code <> 'practical_competency'
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

update public.courses
set audience = 'Workers who support people with epilepsy'
where code = 'ST-01';
