alter table public.assistant_chats
  add column purpose text not null default 'general'
  check (purpose in ('general', 'internal_audit'));
