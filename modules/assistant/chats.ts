import { createServerSupabase } from "@/lib/supabase/server"
import type { TenantContext } from "@/lib/tenant"
import {
  parseStoredMessages,
  type AssistantStoredMessage,
} from "@/modules/assistant/messages"
import { applyProposalOutcomes } from "@/modules/assistant/ratings"

export type AssistantChatPurpose = "general" | "internal_audit"

export function assistantChatPurpose(value: string | null | undefined): AssistantChatPurpose {
  return value === "internal_audit" ? "internal_audit" : "general"
}

export type AssistantChatRecord = {
  id: string
  title: string
  messages: AssistantStoredMessage[]
  interviewAuditId: string | null
  assignmentId: string | null
  purpose: AssistantChatPurpose
}

export type AssistantChatLink = {
  id: string
  title: string
  locked: boolean
  purpose: AssistantChatPurpose
  updatedAt: string
}

export type InternalAuditReview = {
  id: string
  title: string
  updatedAt: string
  findings: number
}

export async function listInternalAuditReviews(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("assistant_chats")
    .select("id, title, updated_at, messages")
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .eq("purpose", "internal_audit")
    .is("assignment_id", null)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)

  return (data ?? []).map((chat) => {
    const findings = parseStoredMessages(chat.messages).reduce(
      (count, message) => count + (message.findings?.length ?? 0),
      0
    )
    return {
      id: chat.id,
      title: chat.title,
      updatedAt: chat.updated_at,
      findings,
    }
  }) satisfies InternalAuditReview[]
}

export async function listAssistantChats(context: TenantContext) {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("assistant_chats")
    .select("id, title, assignment_id, purpose, updated_at")
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .is("assignment_id", null)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(20)

  return (data ?? []).map((chat) => ({
    id: chat.id,
    title: chat.title,
    locked: Boolean(chat.assignment_id),
    purpose: assistantChatPurpose(chat.purpose),
    updatedAt: chat.updated_at,
  })) satisfies AssistantChatLink[]
}

export async function getAssistantChat(context: TenantContext, id: string) {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("assistant_chats")
    .select("id, title, messages, assignment_id, purpose")
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .is("archived_at", null)
    .maybeSingle()

  if (!data) return null
  let interviewAuditId: string | null = null
  let messages = parseStoredMessages(data.messages)
  if (data.assignment_id) {
    const { data: assignment } = await supabase
      .from("internal_audit_assignments")
      .select("audit_id")
      .eq("id", data.assignment_id)
      .maybeSingle()
    interviewAuditId = assignment?.audit_id ?? null
    const { data: proposals } = await supabase
      .from("internal_audit_rating_proposals")
      .select("id, used_at, cancelled_at")
      .eq("assignment_id", data.assignment_id)
    messages = applyProposalOutcomes(messages, proposals ?? [])
  }
  const chat: AssistantChatRecord = {
    id: data.id,
    title: data.title,
    messages,
    interviewAuditId,
    assignmentId: data.assignment_id,
    purpose: assistantChatPurpose(data.purpose),
  }
  return chat
}
