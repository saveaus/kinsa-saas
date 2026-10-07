-- Word attachments can be stored with a policy.
-- A file can be renamed or removed, and a policy can be moved into a file.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]
where id = 'policies';

grant update, delete on public.policy_files to authenticated;

create policy policy_files_update on public.policy_files
  for update to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  )
  with check (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create policy policy_files_delete on public.policy_files
  for delete to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
  );

create or replace function private.policy_files_keep_place()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.organisation_id is distinct from old.organisation_id
     or new.category is distinct from old.category
     or new.created_by is distinct from old.created_by then
    raise exception 'Only the file name can change';
  end if;
  return new;
end;
$$;

revoke all on function private.policy_files_keep_place() from public, anon, authenticated;

create trigger policy_files_keep_place
  before update on public.policy_files
  for each row execute function private.policy_files_keep_place();

create or replace function private.move_policy_to_file(
  p_policy_id uuid,
  p_file_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  file_organisation uuid;
  file_category text;
  policy_organisation uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not private.user_has_permission('settings.manage') then
    raise exception 'not allowed';
  end if;

  select organisation_id, category
    into file_organisation, file_category
  from public.policy_files
  where id = p_file_id;

  if file_organisation is null
     or file_organisation not in (select private.user_organisation_ids()) then
    raise exception 'file not found';
  end if;

  select organisation_id
    into policy_organisation
  from public.policies
  where id = p_policy_id;

  if policy_organisation is distinct from file_organisation then
    raise exception 'policy not found';
  end if;

  update public.policies
  set file_id = p_file_id,
      category = file_category
  where id = p_policy_id;
end;
$$;

revoke all on function private.move_policy_to_file(uuid, uuid) from public, anon, authenticated;
grant execute on function private.move_policy_to_file(uuid, uuid) to authenticated, service_role;

create or replace function public.move_policy_to_file(
  p_policy_id uuid,
  p_file_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.move_policy_to_file(p_policy_id, p_file_id);
end;
$$;

revoke all on function public.move_policy_to_file(uuid, uuid) from public, anon, authenticated;
grant execute on function public.move_policy_to_file(uuid, uuid) to authenticated, service_role;
