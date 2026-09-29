alter table public.courses
  add column cover_image text;

update public.courses
set cover_image = '/training/infection-control/cover.svg'
where title = 'Infection prevention and control';
