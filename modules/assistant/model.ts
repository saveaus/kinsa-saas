/** Free-tier chat model. Gemini 3.1 Flash Lite needs paid AI Gateway credits. */
export const assistantModel =
  process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash-lite"

export const assistantReplyTokens = 400
export const policyReplyTokens = 2200
export const assistantHistoryLimit = 6
export const interviewReplyTokens = 700
export const interviewHistoryLimit = 24
