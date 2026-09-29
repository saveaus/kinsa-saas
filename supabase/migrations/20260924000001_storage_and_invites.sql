-- Private document bucket and invite acceptance (token, no login required to receive email).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'worker-documents',
  'worker-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

create policy worker_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'worker-documents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and (
      private.user_has_permission('documents.read_all')
      or (storage.foldername(name))[2] = private.user_worker_id()::text
    )
  );

create policy worker_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'worker-documents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and (
      private.user_has_permission('documents.read_all')
      or (storage.foldername(name))[2] = private.user_worker_id()::text
    )
  );

create policy worker_documents_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'worker-documents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and (
      private.user_has_permission('documents.read_all')
      or (storage.foldername(name))[2] = private.user_worker_id()::text
    )
  )
  with check (
    bucket_id = 'worker-documents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
  );

create policy worker_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'worker-documents'
    and (storage.foldername(name))[1] in (
      select private.user_organisation_ids()::text
    )
    and private.user_has_permission('workers.manage')
  );

create or replace function public.accept_invite(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.invites%rowtype;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into user_email from public.users where id = auth.uid();

  select * into invite_row
  from public.invites
  where token_hash = p_token_hash
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invite is invalid or expired';
  end if;

  if lower(invite_row.email) <> lower(coalesce(user_email, '')) then
    raise exception 'invite email does not match this account';
  end if;

  if exists (select 1 from public.memberships m where m.user_id = auth.uid()) then
    raise exception 'already a member of an organisation';
  end if;

  insert into public.memberships (user_id, organisation_id, role)
  values (auth.uid(), invite_row.organisation_id, 'worker');

  update public.workers
  set user_id = auth.uid()
  where id = invite_row.worker_id
    and organisation_id = invite_row.organisation_id
    and deleted_at is null;

  update public.invites
  set accepted_at = now()
  where id = invite_row.id;

  perform private.write_audit(
    invite_row.organisation_id,
    'worker.invited',
    'worker',
    invite_row.worker_id,
    jsonb_build_object('accepted', true)
  );

  return invite_row.organisation_id;
end;
$$;

grant execute on function public.accept_invite(text) to authenticated;
