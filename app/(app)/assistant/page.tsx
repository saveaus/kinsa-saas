import { AssistantChat } from "@/components/assistant-chat"
import { can, requireTenant } from "@/lib/tenant"
import { loginPromptSuggestions } from "@/modules/assistant/login-prompts"

export default async function AssistantPage() {
  const { context } = await requireTenant()
  const suggestions = await loginPromptSuggestions(context, undefined, 8)
  return (
    <AssistantChat
      suggestions={suggestions}
      canImport={can(context, "workers.manage") && can(context, "documents.read_all")}
    />
  )
}
