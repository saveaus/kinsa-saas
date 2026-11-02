-- A worker marked inactive has left: they lose organisation access, and get it
-- back if reactivated. Administrators are not affected by their own worker row.
create or replace function private.user_is_inactive_worker()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.workers w
      on w.user_id = m.user_id
     and w.organisation_id = m.organisation_id
    where m.user_id = auth.uid()
      and m.role = 'worker'
      and w.deleted_at is null
      and w.employment_status = 'inactive'
  );
$$;

revoke all on function private.user_is_inactive_worker() from public, anon;
grant execute on function private.user_is_inactive_worker() to authenticated, service_role;

create or replace function public.current_user_is_inactive()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.user_is_inactive_worker();
$$;

revoke all on function public.current_user_is_inactive() from public, anon;
grant execute on function public.current_user_is_inactive() to authenticated;

-- Nearly every policy scopes by this, so it closes reads and writes together.
create or replace function private.user_organisation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organisation_id
  from public.memberships m
  where m.user_id = auth.uid()
    and not private.user_is_inactive_worker();
$$;

create or replace function private.user_has_permission(requested public.app_permission)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not private.user_is_inactive_worker()
  and (
    exists (
      select 1
      from public.memberships m
      join public.role_permissions rp
        on rp.role = m.role
      where m.user_id = auth.uid()
        and m.role = 'admin'
        and rp.permission = requested
    )
    or exists (
      select 1
      from public.memberships m
      join public.workers w
        on w.user_id = m.user_id
       and w.organisation_id = m.organisation_id
       and w.deleted_at is null
      join public.teams t
        on t.organisation_id = w.organisation_id
       and t.code = any (w.staff_roles)
      join public.team_permissions tp
        on tp.team_id = t.id
       and tp.permission = requested
      where m.user_id = auth.uid()
        and m.role = 'worker'
    )
    or (
      exists (
        select 1
        from public.memberships m
        where m.user_id = auth.uid()
          and m.role = 'worker'
      )
      and not exists (
        select 1
        from public.workers w
        join public.teams t
          on t.organisation_id = w.organisation_id
         and t.code = any (w.staff_roles)
        where w.user_id = auth.uid()
          and w.deleted_at is null
      )
      and exists (
        select 1
        from public.memberships m
        join public.role_permissions rp
          on rp.role = m.role
        where m.user_id = auth.uid()
          and m.role = 'worker'
          and rp.permission = requested
      )
    )
  );
$$;

-- A due entry was permanently overdue because nothing could close it.
alter table public.log_entries
  add column completed_at timestamptz,
  add column completed_by uuid references public.users (id) on delete set null;

create index log_entries_open_due_idx
  on public.log_entries (organisation_id, due_on)
  where due_on is not null and completed_at is null;
