alter table public.courses
  add column code text,
  add column audience text,
  add column standards text,
  add column requirement_status text,
  add column kind text not null default 'course' check (kind in ('course', 'bite', 'checkpoint', 'hub'));

create unique index courses_organisation_code_idx
  on public.courses (organisation_id, code)
  where code is not null;
