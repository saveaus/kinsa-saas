-- Tasks assigned to staff. An assignee sees their own. Someone who can manage workers sees and assigns all of them.

create type public.staff_task_status as enum ('open', 'done');

create table public.staff_tasks (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  detail text,
  assignee_id uuid not null references public.workers (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  status public.staff_task_status not null default 'open',
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_tasks_detail_length check (
    detail is null or char_length(detail) <= 400
  ),
  constraint staff_tasks_completion_check check (
    (
      status = 'open'
      and completed_at is null
    )
    or (
      status = 'done'
      and completed_at is not null
    )
  )
);

create index staff_tasks_organisation_status_idx
  on public.staff_tasks (organisation_id, status, due_on);

create trigger staff_tasks_set_updated_at
  before update on public.staff_tasks
  for each row execute function private.set_updated_at();

alter table public.staff_tasks enable row level security;

revoke all on public.staff_tasks from public, anon;
grant select, insert, update on public.staff_tasks to authenticated, service_role;

create policy staff_tasks_select on public.staff_tasks
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('workers.manage')
      or assignee_id = private.user_worker_id()
    )
  );

create policy staff_tasks_insert on public.staff_tasks
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('workers.manage')
    and exists (
      select 1
      from public.workers w
      where w.id = assignee_id
        and w.organisation_id = organisation_id
        and w.deleted_at is null
        and w.employment_status = 'active'
    )
  );

create policy staff_tasks_update on public.staff_tasks
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('workers.manage')
      or assignee_id = private.user_worker_id()
    )
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('workers.manage')
      or assignee_id = private.user_worker_id()
    )
  );
