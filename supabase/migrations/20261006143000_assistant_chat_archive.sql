alter table public.assistant_chats
  add column if not exists archived_at timestamptz;
