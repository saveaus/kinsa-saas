-- Organisation logo: column plus a private bucket. Admins may replace the file and the path only.

alter table public.organisations
  add column logo_path text;

revoke update on table public.organisations from authenticated;
grant update (logo_path) on table public.organisations to authenticated;

create policy organisations_update_logo on public.organisations
  for update to authenticated
  using (
    id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (
    id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organisation-logos',
  'organisation-logos',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

create policy organisation_logos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'organisation-logos'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
  );

create policy organisation_logos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'organisation-logos'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy organisation_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'organisation-logos'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  )
  with check (
    bucket_id = 'organisation-logos'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );

create policy organisation_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'organisation-logos'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('settings.manage')
  );
