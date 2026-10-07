-- A custom log can be assigned to several participants and workers.

create table public.log_register_assignees (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  register_id uuid not null references public.log_registers (id) on delete cascade,
  participant_id uuid references public.participants (id) on delete cascade,
  worker_id uuid references public.workers (id) on delete cascade,
  constraint log_register_assignees_one check (
    (
      participant_id is not null
      and worker_id is null
    )
    or (
      participant_id is null
      and worker_id is not null
    )
  )
);

create unique index log_register_assignees_participant_idx
  on public.log_register_assignees (register_id, participant_id)
  where participant_id is not null;

create unique index log_register_assignees_worker_idx
  on public.log_register_assignees (register_id, worker_id)
  where worker_id is not null;

create index log_register_assignees_organisation_id_idx
  on public.log_register_assignees (organisation_id);

alter table public.log_register_assignees enable row level security;

create policy log_register_assignees_select on public.log_register_assignees
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_register_assignees_insert on public.log_register_assignees
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy log_register_assignees_delete on public.log_register_assignees
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

grant select, insert, delete on public.log_register_assignees to authenticated, service_role;

insert into public.log_register_assignees (
  organisation_id,
  register_id,
  participant_id,
  worker_id
)
select organisation_id, id, participant_id, worker_id
from public.log_registers
where built_in is null
  and (participant_id is not null or worker_id is not null);
