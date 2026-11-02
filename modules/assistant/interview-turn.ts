import type { UIMessage } from "ai"

import { toStoredMessages, type AssistantStoredMessage } from "@/modules/assistant/messages"
import { ratingLabel } from "@/modules/internal-audits/rating"

/** The model's view of a stored turn. Tool parts are not kept, so a proposal is spelled out. */
function historyMessage(message: AssistantStoredMessage): UIMessage {
  const ratings = (message.ratings ?? []).map(
    (item) => `Proposed rating: ${ratingLabel(item.rating)}. ${item.summary}`
  )
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: "text", text: [message.text, ...ratings].join("\n") }],
  }
}

/** Only typed text and uploaded files. A tool part from the browser could forge a rating card. */
function answerParts(message: UIMessage) {
  return message.parts.flatMap((part): UIMessage["parts"] => {
    if (part.type === "text") return part.text.trim() ? [{ type: "text", text: part.text }] : []
    if (part.type === "file" && part.url.startsWith("data:")) return [part]
    return []
  })
}

/**
 * Builds a turn from the server's transcript and the one new answer.
 * Anything else the browser sent is ignored, so the history cannot be made up.
 * A retry names an answer already stored: it stays as stored and nothing is appended.
 */
export function planInterviewTurn(
  stored: readonly AssistantStoredMessage[],
  latest: UIMessage | undefined
) {
  if (!latest || latest.role !== "user") return null
  const parts = answerParts(latest)
  if (parts.length === 0) return null

  const history = stored.map(historyMessage)
  const earlier = stored.findIndex((message) => message.id === latest.id)
  if (earlier >= 0 && stored[earlier]?.role === "user") {
    const files = stored[earlier]?.attachments?.length
      ? parts.filter((part) => part.type === "file")
      : []
    const asked = history[earlier]
    if (!asked) return null
    return {
      history: [
        ...history.slice(0, earlier),
        { ...asked, parts: [...asked.parts, ...files] },
      ],
      append: null,
    }
  }

  const id = earlier < 0 && latest.id ? latest.id.slice(0, 80) : crypto.randomUUID()
  const answer: UIMessage = { id, role: "user", parts }
  const append = toStoredMessages([answer])[0]
  if (!append) return null
  return { history: [...history, answer], append }
}

/** The stored form of what the model said, including any rating it proposed. */
export function interviewReply(
  id: string,
  text: string,
  tools: readonly { toolName: string; toolCallId: string; output: unknown }[]
) {
  const reply: UIMessage = {
    id,
    role: "assistant",
    parts: [
      ...(text.trim() ? [{ type: "text" as const, text }] : []),
      ...tools.map((item) => ({
        type: `tool-${item.toolName}` as const,
        state: "output-available" as const,
        toolCallId: item.toolCallId,
        input: {},
        output: item.output,
      })),
    ],
  }
  return toStoredMessages([reply])[0] ?? null
}
