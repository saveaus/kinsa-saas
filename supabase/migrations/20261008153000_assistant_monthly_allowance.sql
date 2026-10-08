-- Paid plans count assistant tokens per calendar month. Trial usage keeps accumulating.
alter table public.assistant_usage
  add column if not exists period_start timestamptz;

update public.assistant_usage
set period_start = timestamptz '1970-01-01 00:00:00+00'
where period_start is null;

alter table public.assistant_usage
  alter column period_start set default date_trunc('month', pg_catalog.now());

alter table public.assistant_usage
  alter column period_start set not null;

create or replace function public.record_assistant_tokens(
  p_organisation_id uuid,
  p_tokens integer
)
returns void
language plpgsql
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

  insert into public.assistant_usage (organisation_id, tokens_used, period_start)
  values (p_organisation_id, p_tokens, pg_catalog.now())
  on conflict (organisation_id)
  do update set
    tokens_used = public.assistant_usage.tokens_used + excluded.tokens_used,
    updated_at = pg_catalog.now();
end;
$$;

revoke all on function public.record_assistant_tokens(uuid, integer) from public, anon, authenticated;
grant execute on function public.record_assistant_tokens(uuid, integer) to service_role;
