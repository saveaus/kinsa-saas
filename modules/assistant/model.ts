/** Low-to-medium cost chat model from the AI Gateway catalog. */
export const assistantModel =
  process.env.AI_GATEWAY_MODEL || "google/gemini-3.1-flash-lite"

export const assistantReplyTokens = 400
export const assistantHistoryLimit = 6
export const interviewReplyTokens = 700
export const interviewHistoryLimit = 24
