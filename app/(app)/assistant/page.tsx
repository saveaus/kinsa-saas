import { AssistantChat } from "@/components/assistant-chat"
import { ndisUpdate, ndisUpdatePrompt } from "@/lib/ndis-updates"
import {
  practiceStandardName,
  standardsForGroups,
} from "@/lib/ndis-practice-standards"
import { can, requireTenant } from "@/lib/tenant"
import { loginPromptSuggestions } from "@/modules/assistant/login-prompts"
import { loadAssistantUpgrade } from "@/modules/assistant/usage"
import { policyFlagPrompt } from "@/modules/policies/flag-prompt"
import { getPolicy } from "@/modules/policies/queries"

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ update?: string; policy?: string; t?: string }>
}) {
  const { context } = await requireTenant()
  const query = await searchParams
  const update = ndisUpdate(query.update)
  const policyFlag = await flaggedPolicyStart(context, query.policy, query.t)
  const [suggestions, upgrade] = await Promise.all([
    loginPromptSuggestions(context, undefined, 8),
    loadAssistantUpgrade(context.organisationId, can(context, "settings.manage")),
  ])
  const compliancePrompt = "What would make us 20% more compliant today?"
  const prompts = can(context, "workers.manage")
    ? [
        compliancePrompt,
        ...suggestions.filter((prompt) => prompt !== compliancePrompt),
      ]
    : suggestions
  return (
    <AssistantChat
      key={update?.id ?? policyFlag?.stamp ?? "new"}
      suggestions={update || policyFlag ? [] : prompts}
      starter={update && !policyFlag ? ndisUpdatePrompt(update) : undefined}
      policyFlag={policyFlag}
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

async function flaggedPolicyStart(
  context: Awaited<ReturnType<typeof requireTenant>>["context"],
  policyId: string | undefined,
  stamp: string | undefined
) {
  if (!policyId || !/^[0-9a-f-]{36}$/i.test(policyId)) return null
  const policy = await getPolicy(context, policyId)
  if (!policy?.compliance_flagged) return null
  return {
    id: policy.id,
    stamp: stamp || policy.id,
    filename: policy.original_filename ?? `${policy.name}.docx`,
    prompt: policyFlagPrompt({
      id: policy.id,
      name: policy.name,
      standardName: practiceStandardName(policy.standard_code),
      note: policy.compliance_note,
    }),
  }
}
