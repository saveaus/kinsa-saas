-- Close the source-reviewed trust gaps that are not training.
-- Invite email comes from the login token. Document approval and storage
-- paths are not worker-writable. Team grants require the actor to hold the
-- permission. Audit rows are not directly insertable. Assessment updates
-- cannot move organisation. Rate-limit windows are stored, not caller-shrunk.

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

  user_email := auth.jwt() ->> 'email';

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

drop policy users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create or replace function private.guard_document_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if split_part(new.storage_path, '/', 1) is distinct from new.organisation_id::text
     or new.storage_path not like new.organisation_id::text || '/%'
  then
    raise exception 'storage path must stay in this organisation';
  end if;

  if tg_op = 'INSERT' then
    if (
      new.approval_status is distinct from 'pending'
      or new.reviewed_by is not null
      or new.reviewed_at is not null
    ) and not private.user_has_permission('documents.approve') then
      raise exception 'document approval is restricted';
    end if;
    return new;
  end if;

  if new.storage_path is distinct from old.storage_path
     or new.organisation_id is distinct from old.organisation_id
     or new.worker_id is distinct from old.worker_id
  then
    raise exception 'document identity cannot change';
  end if;

  if (
    new.approval_status is distinct from old.approval_status
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
  ) and not private.user_has_permission('documents.approve') then
    raise exception 'document approval is restricted';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_document_row() from public, anon, authenticated;
grant execute on function private.guard_document_row() to authenticated, service_role;

drop trigger if exists documents_guard_privileged_columns on public.documents;
create trigger documents_guard_privileged_columns
  before insert or update on public.documents
  for each row execute function private.guard_document_row();

drop policy team_permissions_write on public.team_permissions;
create policy team_permissions_write on public.team_permissions
  for all to authenticated
  using (
    exists (
      select 1
      from public.teams
      where teams.id = team_permissions.team_id
        and teams.organisation_id in (select private.user_organisation_ids())
    )
    and private.user_has_permission('settings.manage')
    and private.user_has_permission(permission)
  )
  with check (
    exists (
      select 1
      from public.teams
      where teams.id = team_permissions.team_id
        and teams.organisation_id in (select private.user_organisation_ids())
    )
    and private.user_has_permission('settings.manage')
    and private.user_has_permission(permission)
  );

drop policy audit_events_insert on public.audit_events;

drop policy internal_audit_assessments_update_own on public.internal_audit_assessments;
create policy internal_audit_assessments_update_own on public.internal_audit_assessments
  for update to authenticated
  using (
    source = 'assistant'
    and private.internal_audit_assignment_for_user(assignment_id, organisation_id)
  )
  with check (
    source = 'assistant'
    and organisation_id in (select private.user_organisation_ids())
    and organisation_id = (
      select assignment.organisation_id
      from public.internal_audit_assignments assignment
      where assignment.id = assignment_id
    )
  );

drop policy internal_audit_assessments_update_admin on public.internal_audit_assessments;
create policy internal_audit_assessments_update_admin on public.internal_audit_assessments
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (
    source = 'admin'
    and organisation_id in (select private.user_organisation_ids())
    and organisation_id = (
      select assignment.organisation_id
      from public.internal_audit_assignments assignment
      where assignment.id = assignment_id
    )
  );

alter table private.rate_limits
  add column window_seconds integer not null default 300
  check (window_seconds >= 1 and window_seconds <= 86400);

create or replace function private.check_rate_limit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row private.rate_limits%rowtype;
  window_seconds integer;
begin
  if p_key is null or char_length(p_key) < 1 or p_max is null or p_max < 1
     or p_window_seconds is null or p_window_seconds < 1
  then
    return false;
  end if;

  window_seconds := least(p_window_seconds, 86400);

  select * into current_row
  from private.rate_limits
  where key = p_key
  for update;

  if not found then
    begin
      insert into private.rate_limits (key, window_started_at, hit_count, window_seconds)
      values (p_key, pg_catalog.now(), 1, window_seconds);
      return true;
    exception
      when unique_violation then
        select * into current_row
        from private.rate_limits
        where key = p_key
        for update;
    end;
  end if;

  if current_row.window_started_at < pg_catalog.now() - make_interval(secs => current_row.window_seconds) then
    update private.rate_limits
    set window_started_at = pg_catalog.now(), hit_count = 1
    where key = p_key;
    return true;
  end if;

  if current_row.hit_count >= p_max then
    return false;
  end if;

  update private.rate_limits
  set hit_count = hit_count + 1
  where key = p_key;

  return true;
end;
$$;
