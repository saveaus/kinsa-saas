alter table public.organisations
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists billing_plan text,
  add column if not exists billing_status text,
  add column if not exists trial_ends_at timestamptz;

alter table public.organisations
  drop constraint if exists organisations_billing_plan_check;

alter table public.organisations
  add constraint organisations_billing_plan_check
  check (billing_plan is null or billing_plan in ('staff', 'registered'));

alter table public.organisations
  drop constraint if exists organisations_billing_status_check;

alter table public.organisations
  add constraint organisations_billing_status_check
  check (
    billing_status is null
    or billing_status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'paused'
    )
  );

create unique index if not exists organisations_stripe_customer_id_key
  on public.organisations (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists organisations_stripe_subscription_id_key
  on public.organisations (stripe_subscription_id)
  where stripe_subscription_id is not null;

update public.organisations
set
  billing_status = 'trialing',
  trial_ends_at = now() + interval '7 days'
where trial_ends_at is null;

create or replace function private.create_organisation(
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

  insert into public.organisations (
    name,
    registration_groups,
    billing_status,
    trial_ends_at
  )
  values (
    trim(org_name),
    groups,
    'trialing',
    now() + interval '7 days'
  )
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
