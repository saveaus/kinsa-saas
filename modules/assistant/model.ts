/** Free-tier chat model. Flash Lite drops tool calls. Gemini 3 needs paid AI Gateway credits. */
export const assistantModel =
  process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash"

/** Low temperature keeps regulatory answers and health summaries steady. */
export const assistantTemperature = 0.2

export const assistantReplyTokens = 400
/** Ordinary answers stay short. Output tokens cost far more than input. */
export const assistantChatTokens = 600
export const policyReplyTokens = 2200
export const assistantHistoryLimit = 6
export const interviewReplyTokens = 700
export const interviewHistoryLimit = 24

export function policyDraftRequested(text: string) {
  const draft = "(?:draft|write|generate|create)"
  const policy = "polic(?:y|ies)"
  const gap = "(?:\\s+\\w+){0,8}\\s+"
  return new RegExp(`\\b${draft}\\b${gap}${policy}\\b`, "i").test(text)
    || new RegExp(`\\b${policy}\\b${gap}${draft}\\b`, "i").test(text)
}

export function assistantReplyBudget(mode: "general" | "interview" | "audit", text: string) {
  switch (mode) {
    case "general":
      return policyDraftRequested(text) ? policyReplyTokens : assistantChatTokens
    case "interview":
    case "audit":
      return interviewReplyTokens
    default: {
      const unreachable: never = mode
      return unreachable
    }
  }
}
