alter table public.log_registers
  add column if not exists template_key text;

do $$
begin
  alter table public.log_registers
    add constraint log_registers_template_key_check
    check (
      template_key is null
      or template_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    );
exception
  when duplicate_object then null;
end $$;

create unique index if not exists log_registers_organisation_template_key_idx
  on public.log_registers (organisation_id, template_key)
  where template_key is not null;
