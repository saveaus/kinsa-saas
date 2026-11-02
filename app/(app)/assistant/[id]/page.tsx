import { notFound, redirect } from "next/navigation"

import { AssistantChat } from "@/components/assistant-chat"
import { standardsForGroups } from "@/lib/ndis-practice-standards"
import { can, requireTenant } from "@/lib/tenant"
import { loginPromptSuggestions } from "@/modules/assistant/login-prompts"
import { getAssistantChat } from "@/modules/assistant/chats"
import { loadAssistantUpgrade } from "@/modules/assistant/usage"

export default async function SavedAssistantPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { context } = await requireTenant()
  const chat = await getAssistantChat(context, id)
  if (!chat) notFound()
  if (chat.purpose === "internal_audit") redirect(`/audits/reviews/${chat.id}`)
  const [suggestions, upgrade] = await Promise.all([
    loginPromptSuggestions(context),
    loadAssistantUpgrade(context.organisationId, can(context, "settings.manage")),
  ])
  return (
    <AssistantChat
      chat={chat}
      suggestions={suggestions}
      canAssign={can(context, "workers.manage")}
      canImport={
        can(context, "workers.manage") && can(context, "documents.read_all")
      }
      policyStandards={
        can(context, "settings.manage")
          ? standardsForGroups(context.organisationRegistrationGroups).map(
              (standard) => ({ code: standard.code, name: standard.name })
            )
          : []
      }
      upgrade={upgrade}
    />
  )
}
