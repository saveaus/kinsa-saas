import { AssistantChat } from "@/components/assistant-chat"
import { can, requireTenant } from "@/lib/tenant"

export default async function AssistantPage() {
  const { context } = await requireTenant()
  return (
    <AssistantChat
      canImport={can(context, "workers.manage") && can(context, "documents.read_all")}
    />
  )
}
