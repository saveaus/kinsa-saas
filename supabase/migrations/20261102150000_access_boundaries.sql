-- Close access gaps reachable through direct API calls with a signed-in session.
-- Triggers compare current_user because the invite RPC runs as its definer and
-- the service role is trusted server code; only end-user sessions are limited.

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

  -- An invite only opens the worker it was sent for: still that address, unclaimed.
  if not exists (
    select 1
    from public.workers w
    where w.id = invite_row.worker_id
      and w.organisation_id = invite_row.organisation_id
      and w.deleted_at is null
      and w.employment_status = 'active'
      and w.user_id is null
      and lower(w.email) = lower(invite_row.email)
  ) then
    raise exception 'invite is invalid or expired';
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

-- workers.user_id decides whose login a worker delete removes, and whose
-- permissions a team grants, so a session may not point it at someone else.
-- Adding a team may not hand out permissions the actor does not hold.
create or replace function private.guard_worker_access()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  added text[];
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if new.user_id is not null
    and (tg_op = 'INSERT' or new.user_id is distinct from old.user_id)
    and not (
      new.user_id = auth.uid()
      and exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.organisation_id = new.organisation_id
          and m.role = 'admin'
      )
    )
  then
    raise exception 'A login can only be linked by accepting an invite.';
  end if;

  select coalesce(array_agg(code), array[]::text[]) into added
  from unnest(new.staff_roles) as code
  where tg_op = 'INSERT' or not (code = any (old.staff_roles));

  if exists (
    select 1
    from public.teams t
    join public.team_permissions tp on tp.team_id = t.id
    where t.organisation_id = new.organisation_id
      and t.code = any (added)
      and tp.permission <> 'documents.upload_own'
      and not private.user_has_permission(tp.permission)
  ) then
    raise exception 'That team has permissions you do not hold.';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_worker_access() from public, anon;
grant execute on function private.guard_worker_access() to authenticated, service_role;

create trigger workers_guard_access
  before insert or update of user_id, staff_roles on public.workers
  for each row execute function private.guard_worker_access();

-- Permissions resolve through teams.code, so swapping codes would swap grants.
create or replace function private.guard_team_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and (
    new.code is distinct from old.code
    or new.built_in is distinct from old.built_in
    or new.organisation_id is distinct from old.organisation_id
  ) then
    raise exception 'A team keeps its code.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_team_identity() from public, anon;
grant execute on function private.guard_team_identity() to authenticated, service_role;

create trigger teams_guard_identity
  before update on public.teams
  for each row execute function private.guard_team_identity();

-- An assignee moves their task along; they cannot repoint it, which would
-- otherwise let them open any policy file through the task attachment.
create or replace function private.guard_task_assignee_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
    and not private.user_has_permission('workers.manage')
    and (to_jsonb(new) - array['status', 'completed_at', 'updated_at'])
      is distinct from (to_jsonb(old) - array['status', 'completed_at', 'updated_at'])
  then
    raise exception 'An assignee can only update the status of a task.';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_task_assignee_update() from public, anon;
grant execute on function private.guard_task_assignee_update() to authenticated, service_role;

create trigger staff_tasks_guard_assignee
  before update on public.staff_tasks
  for each row execute function private.guard_task_assignee_update();

-- Approval sits on the document row, so a worker must not be able to swap the
-- bytes under an approved document. Uploads never overwrite.
drop policy worker_documents_update on storage.objects;
create policy worker_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'worker-documents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('documents.read_all')
  )
  with check (
    bucket_id = 'worker-documents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('documents.read_all')
  );
