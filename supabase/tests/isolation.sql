-- Cross-tenant isolation verification. Run as a privileged role, then as each tenant.
-- Expected: each authenticated user sees only their organisation's rows.

create extension if not exists pgcrypto;

do $$
declare
  org_a uuid;
  org_b uuid;
  user_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  user_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  worker_a uuid;
  worker_b uuid;
  doc_a uuid;
  doc_b uuid;
  type_id uuid;
begin
  delete from public.memberships where user_id in (user_a, user_b);
  delete from public.users where id in (user_a, user_b);
  delete from auth.users where id in (user_a, user_b);

  insert into public.organisations (name) values ('Isolation Org A') returning id into org_a;
  insert into public.organisations (name) values ('Isolation Org B') returning id into org_b;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    (
      '00000000-0000-0000-0000-000000000000', user_a, 'authenticated', 'authenticated',
      'isolation-a@example.test', crypt('test-password', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', user_b, 'authenticated', 'authenticated',
      'isolation-b@example.test', crypt('test-password', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
      '', '', '', ''
    );

  insert into public.users (id, email, full_name)
  values (user_a, 'isolation-a@example.test', 'Admin A'),
         (user_b, 'isolation-b@example.test', 'Admin B')
  on conflict (id) do update set email = excluded.email;

  insert into public.memberships (user_id, organisation_id, role)
  values (user_a, org_a, 'admin'), (user_b, org_b, 'admin');

  select id into type_id from public.document_type_versions limit 1;

  insert into public.workers (organisation_id, first_name, last_name, email)
  values (org_a, 'Worker', 'Alpha', 'worker-a@example.test')
  returning id into worker_a;

  insert into public.workers (organisation_id, first_name, last_name, email)
  values (org_b, 'Worker', 'Bravo', 'worker-b@example.test')
  returning id into worker_b;

  insert into public.documents (
    organisation_id, worker_id, document_type_version_id, storage_path,
    original_filename, mime_type, file_size_bytes
  ) values
    (org_a, worker_a, type_id, org_a::text || '/secret-a.pdf', 'secret-a.pdf', 'application/pdf', 100)
  returning id into doc_a;

  insert into public.documents (
    organisation_id, worker_id, document_type_version_id, storage_path,
    original_filename, mime_type, file_size_bytes
  ) values
    (org_b, worker_b, type_id, org_b::text || '/secret-b.pdf', 'secret-b.pdf', 'application/pdf', 100)
  returning id into doc_b;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}',
  true
);

-- These counts are asserted by the Node isolation script / MCP follow-up.
select 'orgs_visible' as check, count(*)::int as value from public.organisations;
select 'docs_visible' as check, count(*)::int as value from public.documents;
select 'foreign_doc' as check, count(*)::int as value
from public.documents
where original_filename = 'secret-b.pdf';
