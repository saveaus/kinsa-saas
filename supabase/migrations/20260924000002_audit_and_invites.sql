-- Invite peek (hashed token) and worker-deletion audit anonymisation.

create or replace function public.peek_invite(p_token_hash text)
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

create or replace function private.anonymize_worker_audit(
  p_worker_id uuid,
  p_organisation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.audit_events
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('anonymized', true, 'email', null)
  where organisation_id = p_organisation_id
    and target_type = 'worker'
    and target_id = p_worker_id;
end;
$$;

create or replace function public.anonymize_worker_audit(p_worker_id uuid)
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

revoke all on function public.peek_invite(text) from public;
revoke all on function public.anonymize_worker_audit(uuid) from public;
revoke all on function public.anonymize_worker_audit(uuid) from anon;
grant execute on function public.peek_invite(text) to anon, authenticated;
grant execute on function public.anonymize_worker_audit(uuid) to authenticated;
