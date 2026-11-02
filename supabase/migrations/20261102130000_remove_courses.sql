-- Retire the training library and point follow-ups at a document type or one document.

delete from public.reminder_rules
where category = 'courses';

delete from public.reminder_dispatches
where enrolment_id is not null;

alter table public.reminder_dispatches
  drop constraint if exists reminder_dispatches_target_check;

alter table public.reminder_dispatches
  drop column if exists enrolment_id;

alter table public.reminder_rules
  add column if not exists document_type_version_id uuid references public.document_type_versions (id) on delete cascade,
  add column if not exists document_id uuid references public.documents (id) on delete cascade;

alter table public.reminder_rules
  drop constraint if exists reminder_rules_one_target;

alter table public.reminder_rules
  add constraint reminder_rules_one_target check (
    document_id is null or document_type_version_id is null
  );

alter type public.reminder_category rename to reminder_category_old;

create type public.reminder_category as enum ('documents');

alter table public.reminder_rules
  alter column category type public.reminder_category
  using category::text::public.reminder_category;

drop type public.reminder_category_old;

delete from public.team_permissions
where permission::text in ('courses.manage', 'courses.take');

delete from public.role_permissions
where permission::text in ('courses.manage', 'courses.take');

drop table if exists public.lesson_progress cascade;
drop table if exists public.completions cascade;
drop table if exists public.course_role_requirements cascade;
drop table if exists public.enrolments cascade;
drop table if exists public.course_modules cascade;
drop table if exists public.courses cascade;

drop type if exists public.enrolment_status;
drop type if exists public.course_publication_status;
