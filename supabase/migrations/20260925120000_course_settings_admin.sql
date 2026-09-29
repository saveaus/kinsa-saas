revoke update on table public.courses from authenticated;

grant update (pass_mark, required, renewal_months) on table public.courses to authenticated;

create policy courses_admin_settings on public.courses
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('courses.manage')
  );
