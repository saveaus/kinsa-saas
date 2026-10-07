-- A template copy remembers which library document it came from.
-- category files the policy under a registration group or a shared module.

alter table public.policies
  add column template_key text,
  add column category text;

alter table public.policies
  add constraint policies_category_check check (
    category is null
    or category in ('all', 'core', 'verification', 'implementing')
    or category ~ '^[0-9]{4}$'
  );

create unique index policies_organisation_template_key_uidx
  on public.policies (organisation_id, template_key)
  where template_key is not null;
