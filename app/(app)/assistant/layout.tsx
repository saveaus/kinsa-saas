import type { ReactNode } from "react"

import { AssistantChats } from "@/components/assistant-chats"
import { requireTenant } from "@/lib/tenant"
import { listAssistantChats } from "@/modules/assistant/chats"

export default async function AssistantLayout({
  children,
}: {
  children: ReactNode
}) {
  const { context } = await requireTenant()
  const chats = await listAssistantChats(context)

  return (
    <div
      data-assistant=""
      className="grid min-h-0 min-w-0 flex-1 md:grid-cols-[14.5rem_minmax(0,1fr)]"
    >
      <AssistantChats chats={chats} />
      <div className="flex min-h-0 min-w-0 flex-col">{children}</div>
    </div>
  )
}
