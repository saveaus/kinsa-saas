import { generateText, Output } from "ai"
import { z } from "zod"

import { practiceStandardName } from "@/lib/ndis-practice-standards"
import { ndisUpdates } from "@/lib/ndis-updates"
import { assistantModel, assistantTemperature } from "@/modules/assistant/model"
import {
  loadAssistantAllowance,
  recordAssistantTokens,
} from "@/modules/assistant/usage"
import { policyDocxType } from "@/modules/policies/attachments"
import {
  docxPlainText,
  policyComplianceDecision,
  policyTextLimit,
  unreadPolicyCompliance,
  type PolicyComplianceResult,
} from "@/modules/policies/compliance-check"

const readSchema = z.object({
  current: z.boolean(),
  gaps: z.array(z.string().max(180)).max(4),
})

const clearResult: PolicyComplianceResult = { flagged: false, note: null }

function modelReady() {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN
  )
}

export async function reviewAddedPolicy(input: {
  organisationId: string
  standardCode: string
  filename: string
  mimeType: string | null
  bytes: Uint8Array | null
  text: string | null
}): Promise<PolicyComplianceResult> {
  if (!modelReady()) return clearResult
  const allowance = await loadAssistantAllowance(input.organisationId)
  if (allowance.kind === "spent" || allowance.kind === "ended")
    return clearResult

  const standardName = practiceStandardName(input.standardCode)
  const extracted =
    input.mimeType === policyDocxType && input.bytes
      ? docxPlainText(input.bytes)
      : (input.text ?? "").replace(/\s+/g, " ").trim().slice(0, policyTextLimit)
  const file =
    input.bytes &&
    input.mimeType &&
    input.mimeType !== policyDocxType &&
    (input.mimeType === "application/pdf" ||
      input.mimeType.startsWith("image/"))
      ? {
          data: input.bytes,
          mediaType: input.mimeType,
          filename: input.filename,
        }
      : null
  if (!extracted && !file) return unreadPolicyCompliance()

  try {
    const result = await generateText({
      model: assistantModel,
      temperature: assistantTemperature,
      maxOutputTokens: 300,
      output: Output.object({ schema: readSchema }),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: reviewPrompt(standardName, input.standardCode),
            },
            ...(extracted
              ? [{ type: "text" as const, text: `Policy text:\n${extracted}` }]
              : []),
            ...(file
              ? [
                  {
                    type: "file" as const,
                    data: file.data,
                    mediaType: file.mediaType,
                    filename: file.filename,
                  },
                ]
              : []),
          ],
        },
      ],
    })
    if (allowance.kind === "trial" || allowance.kind === "included") {
      const tokens =
        (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0)
      await recordAssistantTokens(input.organisationId, tokens).catch(
        (error: unknown) => {
          console.error("assistant usage", error)
        }
      )
    }
    if (!result.output) return unreadPolicyCompliance()
    return policyComplianceDecision(result.output)
  } catch (error) {
    console.error("policy compliance", error)
    return clearResult
  }
}

function reviewPrompt(standardName: string, standardCode: string) {
  const updates = ndisUpdates
    .filter((update) => update.kind === "policy")
    .map(
      (update) => `- ${update.title} (${update.publishedOn}): ${update.summary}`
    )
    .join("\n")
  return [
    `Practice standard: ${standardName} (${standardCode}).`,
    "Decide whether this policy and procedure meets that current NDIS Practice Standards outcome.",
    "It is current only when it addresses that outcome and does not conflict with an update below that applies to it.",
    "If it is current, set current to true and leave gaps empty.",
    "If it is not, set current to false and list up to 4 short gaps. Do not quote the standard.",
    "Updates:",
    updates,
  ].join("\n")
}
