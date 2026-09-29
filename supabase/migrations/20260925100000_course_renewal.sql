alter table public.courses
  add column renewal_months integer check (renewal_months is null or renewal_months between 1 and 60);

update public.courses
set renewal_months = 12
where title = 'Infection prevention and control';
