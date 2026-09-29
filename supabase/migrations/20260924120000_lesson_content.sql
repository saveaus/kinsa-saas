alter table public.course_modules
  add column content jsonb;

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  enrolment_id uuid not null references public.enrolments (id) on delete cascade,
  course_module_id uuid not null references public.course_modules (id) on delete cascade,
  step_index integer not null default 0 check (step_index >= 0),
  updated_at timestamptz not null default now(),
  unique (enrolment_id, course_module_id)
);

create index lesson_progress_enrolment_id_idx on public.lesson_progress (enrolment_id);

alter table public.lesson_progress enable row level security;

create policy lesson_progress_select on public.lesson_progress
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('courses.manage')
      or exists (
        select 1 from public.enrolments e
        where e.id = lesson_progress.enrolment_id
          and e.worker_id = private.user_worker_id()
      )
    )
  );

create policy lesson_progress_insert on public.lesson_progress
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and exists (
      select 1 from public.enrolments e
      where e.id = lesson_progress.enrolment_id
        and e.worker_id = private.user_worker_id()
        and private.user_has_permission('courses.take')
    )
  );

create policy lesson_progress_update on public.lesson_progress
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and exists (
      select 1 from public.enrolments e
      where e.id = lesson_progress.enrolment_id
        and e.worker_id = private.user_worker_id()
        and private.user_has_permission('courses.take')
    )
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and exists (
      select 1 from public.enrolments e
      where e.id = lesson_progress.enrolment_id
        and e.worker_id = private.user_worker_id()
    )
  );

create policy completions_update on public.completions
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and exists (
      select 1 from public.enrolments e
      where e.id = completions.enrolment_id
        and e.worker_id = private.user_worker_id()
        and private.user_has_permission('courses.take')
    )
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and exists (
      select 1 from public.enrolments e
      where e.id = completions.enrolment_id
        and e.worker_id = private.user_worker_id()
    )
  );
