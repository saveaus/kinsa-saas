-- The Data API flags SECURITY DEFINER functions in public that anon or
-- authenticated can execute. Keep the privileged work in private, and expose
-- security invoker wrappers that only the intended role can call.

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

create or replace function private.peek_invite(p_token_hash text)
returns table (email text, expires_at timestamptz)
language sql
security definer
set search_path = ''
as $$
  select i.email, i.expires_at
  from public.invites i
  where i.token_hash = p_token_hash
    and i.accepted_at is null
    and i.expires_at > now();
$$;

create or replace function private.accept_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into user_email from public.users where id = auth.uid();

  select * into invite_row
  from public.invites
  where token_hash = p_token_hash
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invite is invalid or expired';
  end if;

  if lower(invite_row.email) <> lower(coalesce(user_email, '')) then
    raise exception 'invite email does not match this account';
  end if;

  if exists (select 1 from public.memberships m where m.user_id = auth.uid()) then
    raise exception 'already a member of an organisation';
  end if;

  insert into public.memberships (user_id, organisation_id, role)
  values (auth.uid(), invite_row.organisation_id, 'worker');

  update public.workers
  set user_id = auth.uid()
  where id = invite_row.worker_id
    and organisation_id = invite_row.organisation_id
    and deleted_at is null;

  update public.invites
  set accepted_at = now()
  where id = invite_row.id;

  perform private.write_audit(
    invite_row.organisation_id,
    'worker.invited',
    'worker',
    invite_row.worker_id,
    jsonb_build_object('accepted', true)
  );

  return invite_row.organisation_id;
end;
$$;

create or replace function private.record_member_audit(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  select private.user_organisation_ids() into org_id;
  if org_id is null then
    raise exception 'not a member of an organisation';
  end if;
  perform private.write_audit(org_id, p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

create or replace function private.anonymize_worker_audit_for_member(p_worker_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  org_id uuid;
begin
  if not private.user_has_permission('workers.manage') then
    raise exception 'not allowed';
  end if;
  select private.user_organisation_ids() into org_id;
  perform private.anonymize_worker_audit(p_worker_id, org_id);
end;
$$;

-- Default privileges grant execute to public. Strip that before opening schema usage.
do $$
declare
  fn record;
begin
  for fn in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  loop
    execute format(
      'revoke all on function private.%I(%s) from public, anon, authenticated',
      fn.proname,
      fn.args
    );
  end loop;
end;
$$;

grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to service_role;

grant execute on function private.user_organisation_ids() to authenticated;
grant execute on function private.user_role() to authenticated;
grant execute on function private.user_worker_id() to authenticated;
grant execute on function private.user_has_permission(public.app_permission) to authenticated;

grant execute on function private.check_rate_limit(text, integer, integer) to anon, authenticated;
grant execute on function private.peek_invite(text) to anon, authenticated;
grant execute on function private.create_organisation(text, text[]) to authenticated;
grant execute on function private.accept_invite(text) to authenticated;
grant execute on function private.record_member_audit(text, text, uuid, jsonb) to authenticated;
grant execute on function private.anonymize_worker_audit_for_member(uuid) to authenticated;

create or replace function public.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.check_rate_limit(p_key, p_max, p_window_seconds);
$$;

create or replace function public.create_organisation(
  org_name text,
  p_registration_groups text[] default '{}'::text[]
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.create_organisation(org_name, p_registration_groups);
$$;

create or replace function public.peek_invite(p_token_hash text)
returns table (email text, expires_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select email, expires_at from private.peek_invite(p_token_hash);
$$;

create or replace function public.accept_invite(p_token_hash text)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.accept_invite(p_token_hash);
$$;

create or replace function public.record_audit(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.record_member_audit(p_action, p_target_type, p_target_id, p_metadata);
end;
$$;

create or replace function public.anonymize_worker_audit(p_worker_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.anonymize_worker_audit_for_member(p_worker_id);
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.create_organisation(text, text[]) from public, anon, authenticated;
revoke all on function public.peek_invite(text) from public, anon, authenticated;
revoke all on function public.accept_invite(text) from public, anon, authenticated;
revoke all on function public.record_audit(text, text, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.anonymize_worker_audit(uuid) from public, anon, authenticated;

grant execute on function public.check_rate_limit(text, integer, integer) to anon, authenticated, service_role;
grant execute on function public.peek_invite(text) to anon, authenticated, service_role;
grant execute on function public.create_organisation(text, text[]) to authenticated, service_role;
grant execute on function public.accept_invite(text) to authenticated, service_role;
grant execute on function public.record_audit(text, text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.anonymize_worker_audit(uuid) to authenticated, service_role;
