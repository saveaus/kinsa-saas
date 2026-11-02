-- An interview rating can only come from a proposal the server minted during
-- the record_assessment tool call. Interview transcripts are written by the
-- server, so the person being interviewed cannot rewrite them with their JWT.
-- Assistant token claims are settled to what a turn actually used.
-- A revised policy can replace the flagged one when it is accepted.

create table public.internal_audit_rating_proposals (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations (id) on delete cascade,
  assignment_id uuid not null references public.internal_audit_assignments (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  rating text not null check (rating in ('met', 'partial', 'not_met')),
  summary text not null check (char_length(summary) between 1 and 2000),
  created_at timestamptz not null default now(),
  used_at timestamptz,
  cancelled_at timestamptz,
  constraint internal_audit_rating_proposals_one_outcome check (
    used_at is null or cancelled_at is null
  )
);

create index internal_audit_rating_proposals_assignment_idx
  on public.internal_audit_rating_proposals (assignment_id);

alter table public.internal_audit_rating_proposals enable row level security;

revoke all on public.internal_audit_rating_proposals from public, anon, authenticated;
grant select on public.internal_audit_rating_proposals to authenticated;
grant all on public.internal_audit_rating_proposals to service_role;

-- Read only, so a reloaded interview can show what happened to each proposal.
create policy internal_audit_rating_proposals_select on public.internal_audit_rating_proposals
  for select to authenticated
  using (
    organisation_id in (select private.user_organisation_ids())
    and (
      user_id = (select auth.uid())
      or private.user_has_permission('settings.manage')
    )
  );

-- The assistant's ratings are written through confirm_interview_rating only.
drop policy internal_audit_assessments_update_own on public.internal_audit_assessments;

drop policy internal_audit_assessments_insert on public.internal_audit_assessments;
create policy internal_audit_assessments_insert on public.internal_audit_assessments
  for insert to authenticated
  with check (
    source = 'admin'
    and organisation_id in (select private.user_organisation_ids())
    and private.user_has_permission('settings.manage')
    and private.internal_audit_assignment_in_organisation(assignment_id, organisation_id)
  );

-- Interview chats belong to the server. General and internal audit chats stay editable.
drop policy assistant_chats_insert on public.assistant_chats;
create policy assistant_chats_insert on public.assistant_chats
  for insert to authenticated
  with check (
    assignment_id is null
    and user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  );

drop policy assistant_chats_update on public.assistant_chats;
create policy assistant_chats_update on public.assistant_chats
  for update to authenticated
  using (
    assignment_id is null
    and user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  )
  with check (
    assignment_id is null
    and user_id = (select auth.uid())
    and organisation_id in (select private.user_organisation_ids())
  );

create or replace function public.append_interview_messages(
  p_chat_id uuid,
  p_organisation_id uuid,
  p_user_id uuid,
  p_messages jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_messages is null or jsonb_typeof(p_messages) <> 'array' then
    return false;
  end if;

  update public.assistant_chats as chat
  set messages = chat.messages || p_messages
  where chat.id = p_chat_id
    and chat.organisation_id = p_organisation_id
    and chat.user_id = p_user_id
    and chat.assignment_id is not null;

  return found;
end;
$$;

create or replace function public.confirm_interview_rating(
  p_proposal_id uuid,
  p_organisation_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  proposal public.internal_audit_rating_proposals%rowtype;
  audit_id uuid;
  earlier_rating text;
  earlier_source text;
begin
  select *
  into proposal
  from public.internal_audit_rating_proposals as p
  where p.id = p_proposal_id
    and p.organisation_id = p_organisation_id
    and p.user_id = p_user_id
  for update;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if proposal.used_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  if proposal.cancelled_at is not null then
    return jsonb_build_object('status', 'cancelled');
  end if;

  select a.audit_id
  into audit_id
  from public.internal_audit_assignments as a
  where a.id = proposal.assignment_id
    and a.organisation_id = p_organisation_id
    and a.user_id = p_user_id;

  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  select e.rating, e.source
  into earlier_rating, earlier_source
  from public.internal_audit_assessments as e
  where e.assignment_id = proposal.assignment_id
  for update;

  if earlier_source = 'admin' then
    return jsonb_build_object('status', 'admin_set');
  end if;

  insert into public.internal_audit_assessments (
    assignment_id, organisation_id, rating, source, summary
  )
  values (
    proposal.assignment_id, p_organisation_id, proposal.rating, 'assistant', proposal.summary
  )
  on conflict (assignment_id) do update
  set rating = excluded.rating,
      source = excluded.source,
      summary = excluded.summary
  where public.internal_audit_assessments.source = 'assistant';

  if not found then
    return jsonb_build_object('status', 'admin_set');
  end if;

  update public.internal_audit_rating_proposals as p
  set used_at = pg_catalog.now()
  where p.id = proposal.id;

  return jsonb_build_object(
    'status', 'saved',
    'assignment_id', proposal.assignment_id,
    'audit_id', audit_id,
    'rating', proposal.rating,
    'changed', earlier_rating is distinct from proposal.rating or earlier_source is distinct from 'assistant'
  );
end;
$$;

-- Moves a claim to what the turn really used. One update statement, so
-- concurrent claims and settlements cannot lose each other's tokens. A claim
-- from before a monthly reset is dropped: that month's count is already gone.
create or replace function public.settle_assistant_tokens(
  p_organisation_id uuid,
  p_claimed integer,
  p_actual integer,
  p_claimed_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  billing text;
  difference integer;
begin
  difference := greatest(coalesce(p_actual, 0), 0) - greatest(coalesce(p_claimed, 0), 0);
  if difference = 0 then
    return;
  end if;

  select o.billing_status
  into billing
  from public.organisations as o
  where o.id = p_organisation_id;

  update public.assistant_usage as u
  set tokens_used = case
        when billing = 'active' then greatest(0, u.tokens_used + difference)
        else least(50000, greatest(0, u.tokens_used + difference))
      end,
      updated_at = pg_catalog.now()
  where u.organisation_id = p_organisation_id
    and (
      billing is distinct from 'active'
      or p_claimed_at is null
      or u.period_start <= p_claimed_at
    );
end;
$$;

revoke all on function public.append_interview_messages(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.append_interview_messages(uuid, uuid, uuid, jsonb) to service_role;

revoke all on function public.confirm_interview_rating(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_interview_rating(uuid, uuid, uuid) to service_role;

revoke all on function public.settle_assistant_tokens(uuid, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.settle_assistant_tokens(uuid, integer, integer, timestamptz) to service_role;

-- A revision of an accepted policy waits as a draft, so the accepted one keeps
-- counting. When the draft is accepted it replaces the flagged policy.
alter table public.policies
  add column supersedes_policy_id uuid references public.policies (id) on delete set null;

create index policies_supersedes_policy_id_idx
  on public.policies (supersedes_policy_id)
  where supersedes_policy_id is not null;

create or replace function private.replace_superseded_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  replaced_name text;
begin
  delete from public.policies as old_policy
  where old_policy.id = new.supersedes_policy_id
    and old_policy.organisation_id = new.organisation_id
    and old_policy.standard_code = new.standard_code
    and old_policy.compliance_flagged
  returning old_policy.name into replaced_name;

  if replaced_name is not null then
    insert into public.audit_events (organisation_id, actor_user_id, action, target_type, target_id, metadata)
    values (
      new.organisation_id,
      auth.uid(),
      'policy.replaced',
      'policy',
      new.id,
      jsonb_build_object('name', new.name, 'replaced', replaced_name, 'replacedId', new.supersedes_policy_id)
    );
  end if;

  return new;
end;
$$;

revoke all on function private.replace_superseded_policy() from public, anon, authenticated;

create trigger policies_replace_superseded
  after update of status on public.policies
  for each row
  when (
    old.status = 'draft'
    and new.status = 'accepted'
    and new.supersedes_policy_id is not null
  )
  execute function private.replace_superseded_policy();
