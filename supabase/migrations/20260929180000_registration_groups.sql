-- Store which NDIS registration groups (classes of support) the provider holds.

alter table public.organisations
  add column if not exists registration_groups text[] not null default '{}';

alter table public.organisations
  drop constraint if exists organisations_registration_groups_codes;

alter table public.organisations
  add constraint organisations_registration_groups_codes
  check (
    registration_groups <@ array[
      '0101','0102','0103','0104','0105','0106','0107','0108','0109','0110',
      '0111','0112','0113','0114','0115','0116','0117','0118','0119','0120',
      '0121','0122','0123','0124','0125','0126','0127','0128','0129','0130',
      '0131','0132','0133','0134','0135','0136','0137','0138'
    ]::text[]
  );

revoke update on table public.organisations from authenticated;
grant update (name, logo_path, abn, registration_number, registration_groups) on table public.organisations to authenticated;

drop function if exists public.create_organisation(text);

create or replace function public.create_organisation(
  org_name text,
  p_registration_groups text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
  groups text[] := coalesce(p_registration_groups, '{}'::text[]);
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

  if cardinality(groups) = 0 then
    raise exception 'select at least one registration group';
  end if;

  if not (
    groups <@ array[
      '0101','0102','0103','0104','0105','0106','0107','0108','0109','0110',
      '0111','0112','0113','0114','0115','0116','0117','0118','0119','0120',
      '0121','0122','0123','0124','0125','0126','0127','0128','0129','0130',
      '0131','0132','0133','0134','0135','0136','0137','0138'
    ]::text[]
  ) then
    raise exception 'invalid registration group';
  end if;

  insert into public.organisations (name, registration_groups)
  values (trim(org_name), groups)
  returning id into org_id;

  insert into public.memberships (user_id, organisation_id, role)
  values (auth.uid(), org_id, 'admin');

  perform private.seed_organisation_defaults(org_id);
  perform private.write_audit(
    org_id,
    'organisation.created',
    'organisation',
    org_id,
    jsonb_build_object('name', trim(org_name), 'registration_groups', to_jsonb(groups))
  );

  return org_id;
end;
$$;

grant execute on function public.create_organisation(text, text[]) to authenticated;
