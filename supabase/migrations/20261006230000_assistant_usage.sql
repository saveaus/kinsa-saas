create table public.assistant_usage (
  organisation_id uuid primary key references public.organisations (id) on delete cascade,
  tokens_used integer not null default 0 check (tokens_used >= 0),
  updated_at timestamptz not null default now()
);

alter table public.assistant_usage enable row level security;

revoke all on public.assistant_usage from public, anon, authenticated;
grant select on public.assistant_usage to authenticated;
grant select, insert, update, delete on public.assistant_usage to service_role;

create policy assistant_usage_select on public.assistant_usage
  for select to authenticated
  using (organisation_id in (select private.user_organisation_ids()));

-- Service role records usage. Authenticated cannot call this, so a trial
-- cannot reset its own allowance.
create or replace function public.record_assistant_tokens(
  p_organisation_id uuid,
  p_tokens integer
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_tokens is null or p_tokens <= 0 then
    return;
  end if;

  insert into public.assistant_usage (organisation_id, tokens_used)
  values (p_organisation_id, p_tokens)
  on conflict (organisation_id)
  do update set
    tokens_used = public.assistant_usage.tokens_used + excluded.tokens_used,
    updated_at = pg_catalog.now();
end;
$$;

revoke all on function public.record_assistant_tokens(uuid, integer) from public, anon, authenticated;
grant execute on function public.record_assistant_tokens(uuid, integer) to service_role;
