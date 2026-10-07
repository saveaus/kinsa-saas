-- Cross-table policy checks re-enter row level security and Postgres
-- reports infinite recursion. These helpers read as the owner.

create or replace function private.internal_audit_in_organisation(
  p_audit_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_audits audit
    where audit.id = p_audit_id
      and audit.organisation_id = p_organisation_id
  );
$$;

create or replace function private.user_assigned_to_internal_audit(p_audit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_audit_assignments assignment
    where assignment.audit_id = p_audit_id
      and assignment.user_id = (select auth.uid())
  );
$$;

create or replace function private.internal_audit_assignment_for_user(
  p_assignment_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_audit_assignments assignment
    where assignment.id = p_assignment_id
      and assignment.organisation_id = p_organisation_id
      and assignment.user_id = (select auth.uid())
  );
$$;

create or replace function private.internal_audit_assignment_in_organisation(
  p_assignment_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.internal_audit_assignments assignment
    where assignment.id = p_assignment_id
      and assignment.organisation_id = p_organisation_id
  );
$$;

create or replace function private.member_of_organisation(
  p_user_id uuid,
  p_organisation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships member
    where member.user_id = p_user_id
      and member.organisation_id = p_organisation_id
  );
$$;

create or replace function private.internal_audit_assignment_started(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.assistant_chats chat
    where chat.assignment_id = p_assignment_id
  )
  or exists (
    select 1
    from public.internal_audit_assessments assessment
    where assessment.assignment_id = p_assignment_id
  );
$$;

revoke all on function private.internal_audit_in_organisation(uuid, uuid) from public, anon;
revoke all on function private.user_assigned_to_internal_audit(uuid) from public, anon;
revoke all on function private.internal_audit_assignment_for_user(uuid, uuid) from public, anon;
revoke all on function private.internal_audit_assignment_in_organisation(uuid, uuid) from public, anon;
revoke all on function private.member_of_organisation(uuid, uuid) from public, anon;
revoke all on function private.internal_audit_assignment_started(uuid) from public, anon;

grant execute on function private.internal_audit_in_organisation(uuid, uuid) to authenticated;
grant execute on function private.user_assigned_to_internal_audit(uuid) to authenticated;
grant execute on function private.internal_audit_assignment_for_user(uuid, uuid) to authenticated;
grant execute on function private.internal_audit_assignment_in_organisation(uuid, uuid) to authenticated;
grant execute on function private.member_of_organisation(uuid, uuid) to authenticated;
grant execute on function private.internal_audit_assignment_started(uuid) to authenticated;

drop policy internal_audits_select on public.internal_audits;

create policy internal_audits_select on public.internal_audits
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('settings.manage')
      or private.user_assigned_to_internal_audit(id)
    )
  );

drop policy internal_audit_assignments_insert on public.internal_audit_assignments;

create policy internal_audit_assignments_insert on public.internal_audit_assignments
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and assigned_by = (select auth.uid())
    and private.user_has_permission('settings.manage')
    and private.internal_audit_in_organisation(audit_id, organisation_id)
    and private.member_of_organisation(user_id, organisation_id)
  );

drop policy internal_audit_assignments_delete on public.internal_audit_assignments;

create policy internal_audit_assignments_delete on public.internal_audit_assignments
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and not private.internal_audit_assignment_started(id)
  );

drop policy internal_audit_assessments_select on public.internal_audit_assessments;

create policy internal_audit_assessments_select on public.internal_audit_assessments
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('settings.manage')
      or private.internal_audit_assignment_for_user(assignment_id, organisation_id)
    )
  );

drop policy internal_audit_assessments_insert on public.internal_audit_assessments;

create policy internal_audit_assessments_insert on public.internal_audit_assessments
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and (
      (
        source = 'assistant'
        and private.internal_audit_assignment_for_user(assignment_id, organisation_id)
      )
      or (
        source = 'admin'
        and private.user_has_permission('settings.manage')
        and private.internal_audit_assignment_in_organisation(assignment_id, organisation_id)
      )
    )
  );

drop policy internal_audit_assessments_update_own on public.internal_audit_assessments;

create policy internal_audit_assessments_update_own on public.internal_audit_assessments
  for update to authenticated
  using (
    source = 'assistant'
    and private.internal_audit_assignment_for_user(assignment_id, organisation_id)
  )
  with check (source = 'assistant');

drop policy assistant_chats_insert on public.assistant_chats;

create policy assistant_chats_insert on public.assistant_chats
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
    and (
      assignment_id is null
      or private.internal_audit_assignment_for_user(assignment_id, organisation_id)
    )
  );
