"use server"

import { revalidatePath } from "next/cache"

import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant"
import { canConductInternalAudit } from "@/modules/internal-audits/access"
import {
  chatTitleFrom,
  cleanChatTitle,
  parseStoredMessages,
  storedMessagesJson,
  type AssistantStoredMessage,
} from "@/modules/assistant/messages"

export type AssistantChatActionResult = { error?: string; id?: string }

async function ownedInterview(id: string, context: { organisationId: string; userId: string }) {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from("assistant_chats")
    .select("assignment_id")
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .maybeSingle()
  if (data?.assignment_id) return "This interview stays with the internal audit."
  return null
}

function refreshChats() {
  revalidatePath("/assistant", "layout")
  revalidatePath("/audits")
}

export async function saveAssistantChat(
  messages: AssistantStoredMessage[],
  options?: { purpose?: "general" | "internal_audit" }
): Promise<AssistantChatActionResult> {
  const { context } = await requireTenant()
  if (options?.purpose === "internal_audit" && !(await canConductInternalAudit(context))) {
    return { error: "An administrator on the Registered plan runs the internal audit." }
  }
  const stored = parseStoredMessages(messages)
  if (stored.length === 0) {
    return { error: "Send a message before saving." }
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("assistant_chats")
    .insert({
      organisation_id: context.organisationId,
      user_id: context.userId,
      title: chatTitleFrom(stored),
      messages: storedMessagesJson(stored),
      purpose: options?.purpose ?? "general",
    })
    .select("id")
    .single()

  if (error || !data) return { error: "The chat could not be saved." }
  refreshChats()
  return { id: data.id }
}

export async function renameAssistantChat(
  id: string,
  title: string
): Promise<AssistantChatActionResult> {
  const { context } = await requireTenant()
  const locked = await ownedInterview(id, context)
  if (locked) return { error: locked }
  const name = cleanChatTitle(title)
  if (name.length < 1) return { error: "Enter a chat name." }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("assistant_chats")
    .update({ title: name })
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .select("id")
    .maybeSingle()

  if (error || !data) return { error: "The chat could not be renamed." }
  refreshChats()
  return { id: data.id }
}

export async function updateAssistantChatMessages(
  id: string,
  messages: AssistantStoredMessage[]
): Promise<AssistantChatActionResult> {
  const { context } = await requireTenant()
  const stored = parseStoredMessages(messages)
  if (stored.length === 0) return { error: "The chat is empty." }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("assistant_chats")
    .update({ messages: storedMessagesJson(stored) })
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .select("id")
    .maybeSingle()

  if (error || !data) return { error: "The chat could not be updated." }
  refreshChats()
  return { id: data.id }
}

export async function archiveAssistantChat(
  id: string
): Promise<AssistantChatActionResult> {
  const { context } = await requireTenant()
  const locked = await ownedInterview(id, context)
  if (locked) return { error: locked }
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("assistant_chats")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .select("id")
    .maybeSingle()

  if (error || !data) return { error: "The chat could not be archived." }
  refreshChats()
  return { id: data.id }
}

export async function deleteAssistantChat(
  id: string
): Promise<AssistantChatActionResult> {
  const { context } = await requireTenant()
  const locked = await ownedInterview(id, context)
  if (locked) return { error: locked }
  const supabase = await createServerSupabase()
  const { data, error } = await supabase
    .from("assistant_chats")
    .delete()
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .eq("user_id", context.userId)
    .select("id")
    .maybeSingle()

  if (error || !data) return { error: "The chat could not be deleted." }
  refreshChats()
  return { id: data.id }
}
