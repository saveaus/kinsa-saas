import { notFound, redirect } from "next/navigation"

import { AssistantChat } from "@/components/assistant-chat"
import { can, requireTenant } from "@/lib/tenant"
import { getAssistantChat } from "@/modules/assistant/chats"

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
  return (
    <AssistantChat
      chat={chat}
      canImport={can(context, "workers.manage") && can(context, "documents.read_all")}
    />
  )
}
