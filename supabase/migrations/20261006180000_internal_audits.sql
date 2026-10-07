create table public.internal_audits (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now()
);

create index internal_audits_org_created_idx
  on public.internal_audits (organisation_id, created_at desc);

create table public.internal_audit_assignments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  audit_id uuid not null references public.internal_audits (id) on delete cascade,
  standard_code text not null check (char_length(standard_code) between 1 and 80),
  user_id uuid not null references public.users (id) on delete cascade,
  assigned_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  unique (audit_id, standard_code, user_id)
);

create index internal_audit_assignments_audit_idx
  on public.internal_audit_assignments (audit_id);

create index internal_audit_assignments_user_idx
  on public.internal_audit_assignments (organisation_id, user_id);

create table public.internal_audit_assessments (
  assignment_id uuid primary key references public.internal_audit_assignments (id) on delete restrict,
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  rating text not null check (rating in ('met', 'partial', 'not_met')),
  source text not null check (source in ('assistant', 'admin')),
  summary text check (summary is null or char_length(summary) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger internal_audit_assessments_set_updated_at
  before update on public.internal_audit_assessments
  for each row execute function private.set_updated_at();

alter table public.assistant_chats
  add column assignment_id uuid unique references public.internal_audit_assignments (id) on delete restrict;

create index assistant_chats_assignment_idx
  on public.assistant_chats (assignment_id)
  where assignment_id is not null;

alter table public.internal_audits enable row level security;
alter table public.internal_audit_assignments enable row level security;
alter table public.internal_audit_assessments enable row level security;

revoke all on public.internal_audits from public, anon;
revoke all on public.internal_audit_assignments from public, anon;
revoke all on public.internal_audit_assessments from public, anon;

grant select, insert on public.internal_audits to authenticated, service_role;
grant select, insert, delete on public.internal_audit_assignments to authenticated, service_role;
grant select, insert, update on public.internal_audit_assessments to authenticated, service_role;

create policy internal_audits_select on public.internal_audits
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('settings.manage')
      or exists (
        select 1
        from public.internal_audit_assignments mine
        where mine.audit_id = internal_audits.id
          and mine.user_id = (select auth.uid())
      )
    )
  );

create policy internal_audits_insert on public.internal_audits
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and created_by = (select auth.uid())
    and private.user_has_permission('settings.manage')
  );

create policy internal_audit_assignments_select on public.internal_audit_assignments
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('settings.manage')
      or user_id = (select auth.uid())
    )
  );

create policy internal_audit_assignments_insert on public.internal_audit_assignments
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and assigned_by = (select auth.uid())
    and private.user_has_permission('settings.manage')
    and exists (
      select 1
      from public.internal_audits audit
      where audit.id = audit_id
        and audit.organisation_id = internal_audit_assignments.organisation_id
    )
    and exists (
      select 1
      from public.memberships member
      where member.user_id = internal_audit_assignments.user_id
        and member.organisation_id = internal_audit_assignments.organisation_id
    )
  );

create policy internal_audit_assignments_delete on public.internal_audit_assignments
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and not exists (
      select 1
      from public.assistant_chats chat
      where chat.assignment_id = internal_audit_assignments.id
    )
    and not exists (
      select 1
      from public.internal_audit_assessments assessment
      where assessment.assignment_id = internal_audit_assignments.id
    )
  );

create policy internal_audit_assessments_select on public.internal_audit_assessments
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      private.user_has_permission('settings.manage')
      or exists (
        select 1
        from public.internal_audit_assignments assignment
        where assignment.id = internal_audit_assessments.assignment_id
          and assignment.user_id = (select auth.uid())
      )
    )
  );

create policy internal_audit_assessments_insert on public.internal_audit_assessments
  for insert to authenticated
  with check (
    organisation_id in (select private.user_organisation_ids())
    and exists (
      select 1
      from public.internal_audit_assignments assignment
      where assignment.id = assignment_id
        and assignment.organisation_id = internal_audit_assessments.organisation_id
        and (
          (
            source = 'assistant'
            and assignment.user_id = (select auth.uid())
          )
          or (
            source = 'admin'
            and private.user_has_permission('settings.manage')
          )
        )
    )
  );

create policy internal_audit_assessments_update_own on public.internal_audit_assessments
  for update to authenticated
  using (
    source = 'assistant'
    and exists (
      select 1
      from public.internal_audit_assignments assignment
      where assignment.id = internal_audit_assessments.assignment_id
        and assignment.user_id = (select auth.uid())
    )
  )
  with check (source = 'assistant');

create policy internal_audit_assessments_update_admin on public.internal_audit_assessments
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (source = 'admin');

drop policy assistant_chats_insert on public.assistant_chats;

create policy assistant_chats_insert on public.assistant_chats
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
    and (
      assignment_id is null
      or exists (
        select 1
        from public.internal_audit_assignments assignment
        where assignment.id = assignment_id
          and assignment.user_id = (select auth.uid())
          and assignment.organisation_id = assistant_chats.organisation_id
      )
    )
  );

drop policy assistant_chats_delete on public.assistant_chats;

create policy assistant_chats_delete on public.assistant_chats
  for delete to authenticated
  using (
    assignment_id is null
    and user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  );

create policy assistant_chats_interview_select on public.assistant_chats
  for select to authenticated
  using (
    assignment_id is not null
    and organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy users_select_org_managers on public.users
  for select to authenticated
  using (
    private.user_has_permission('settings.manage')
    and exists (
      select 1
      from public.memberships member
      where member.user_id = users.id
        and member.organisation_id in (select private.user_organisation_ids())
    )
  );
