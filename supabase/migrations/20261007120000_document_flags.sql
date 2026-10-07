alter table public.documents
  add column flagged boolean not null default false;

comment on column public.documents.flagged is
  'Pending document a person needs to check. The assistant flags instead of rejecting.';
