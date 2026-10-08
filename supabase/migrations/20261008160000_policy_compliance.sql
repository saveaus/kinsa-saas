-- A policy added from a file is checked against its practice standard.
-- A flagged policy can be assigned as a task with the suggested changes.

alter table public.policies
  add column compliance_flagged boolean not null default false,
  add column compliance_note text;

alter table public.policies
  add constraint policies_compliance_note_length check (
    compliance_note is null
    or char_length(compliance_note) <= 400
  );

alter table public.staff_tasks
  add column policy_id uuid references public.policies (id) on delete set null,
  add column changes text;

alter table public.staff_tasks
  add constraint staff_tasks_changes_length check (
    changes is null
    or char_length(changes) <= 2000
  );

create index staff_tasks_policy_id_idx
  on public.staff_tasks (policy_id)
  where policy_id is not null;
