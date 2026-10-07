create table public.assistant_chats (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_chats_messages_array check (jsonb_typeof(messages) = 'array')
);

create index assistant_chats_owner_updated_idx
  on public.assistant_chats (organisation_id, user_id, updated_at desc);

create trigger assistant_chats_set_updated_at
  before update on public.assistant_chats
  for each row execute function private.set_updated_at();

alter table public.assistant_chats enable row level security;

revoke all on public.assistant_chats from public, anon;
grant select, insert, update, delete on public.assistant_chats to authenticated, service_role;

create policy assistant_chats_select on public.assistant_chats
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  );

create policy assistant_chats_insert on public.assistant_chats
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  );

create policy assistant_chats_update on public.assistant_chats
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  )
  with check (
    user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  );

create policy assistant_chats_delete on public.assistant_chats
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  );
