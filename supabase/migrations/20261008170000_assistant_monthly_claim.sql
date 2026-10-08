-- Reserve assistant tokens before the model call.
-- A paid plan gets 150,000 tokens per billed worker, reset each calendar month.
-- A trial still accumulates up to 50,000 for the whole trial.

create or replace function public.record_assistant_tokens(
  p_organisation_id uuid,
  p_tokens integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  billing text;
  month_start timestamptz;
  current_period timestamptz;
begin
  if p_tokens is null or p_tokens <= 0 then
    return;
  end if;

  select o.billing_status
  into billing
  from public.organisations as o
  where o.id = p_organisation_id;

  month_start := date_trunc('month', pg_catalog.now());

  select u.period_start
  into current_period
  from public.assistant_usage as u
  where u.organisation_id = p_organisation_id;

  if billing = 'active' and (current_period is null or current_period < month_start) then
    insert into public.assistant_usage (organisation_id, tokens_used, period_start)
    values (p_organisation_id, p_tokens, month_start)
    on conflict (organisation_id)
    do update set
      tokens_used = excluded.tokens_used,
      period_start = excluded.period_start,
      updated_at = pg_catalog.now();
    return;
  end if;

  if billing = 'active' then
    insert into public.assistant_usage (organisation_id, tokens_used, period_start)
    values (p_organisation_id, p_tokens, month_start)
    on conflict (organisation_id)
    do update set
      tokens_used = public.assistant_usage.tokens_used + excluded.tokens_used,
      updated_at = pg_catalog.now();
    return;
  end if;

  insert into public.assistant_usage (organisation_id, tokens_used)
  values (p_organisation_id, least(50000, p_tokens))
  on conflict (organisation_id)
  do update set
    tokens_used = least(50000, public.assistant_usage.tokens_used + excluded.tokens_used),
    updated_at = pg_catalog.now();
end;
$$;

create or replace function public.claim_assistant_trial_tokens(
  p_organisation_id uuid,
  p_tokens integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  billing text;
  seats integer;
  cap integer;
  month_start timestamptz;
  used integer;
  period timestamptz;
  room integer;
  grant_tokens integer;
begin
  if p_tokens is null or p_tokens <= 0 then
    return 0;
  end if;

  select o.billing_status
  into billing
  from public.organisations as o
  where o.id = p_organisation_id;

  month_start := date_trunc('month', pg_catalog.now());

  if billing = 'active' then
    select count(*)::integer
    into seats
    from public.workers as w
    where w.organisation_id = p_organisation_id
      and w.employment_status = 'active'
      and w.deleted_at is null;
    cap := 150000 * greatest(coalesce(seats, 0), 1);
  else
    cap := 50000;
  end if;

  insert into public.assistant_usage (organisation_id, tokens_used)
  values (p_organisation_id, 0)
  on conflict (organisation_id) do nothing;

  select u.tokens_used, u.period_start
  into used, period
  from public.assistant_usage as u
  where u.organisation_id = p_organisation_id
  for update;

  if billing = 'active' and (period is null or period < month_start) then
    used := 0;
    update public.assistant_usage
    set tokens_used = 0,
        period_start = month_start,
        updated_at = pg_catalog.now()
    where organisation_id = p_organisation_id;
  end if;

  room := cap - coalesce(used, 0);
  if room <= 0 then
    return 0;
  end if;

  grant_tokens := least(p_tokens, room);
  update public.assistant_usage
  set tokens_used = tokens_used + grant_tokens,
      updated_at = pg_catalog.now()
  where organisation_id = p_organisation_id;

  return grant_tokens;
end;
$$;

revoke all on function public.record_assistant_tokens(uuid, integer) from public, anon, authenticated;
grant execute on function public.record_assistant_tokens(uuid, integer) to service_role;

revoke all on function public.claim_assistant_trial_tokens(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_assistant_trial_tokens(uuid, integer) to service_role;
