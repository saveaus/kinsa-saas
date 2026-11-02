import type { UIMessage } from "ai"

/** Vercel rejects a request body over about 4.5 MB. */
export const requestByteBudget = 4_400_000

function partBytes(part: UIMessage["parts"][number]) {
  if (part.type === "file") return part.url.length
  return JSON.stringify(part).length
}

/**
 * The messages to send: the same window the server uses, newest file data first.
 * The newest message always goes whole, because attachments were limited when it was added.
 * Older files keep their place only while the request stays under the budget.
 */
export function requestWindow(
  messages: readonly UIMessage[],
  options: { limit: number; keepFirstUser?: boolean; byteBudget?: number }
): UIMessage[] {
  const recent = messages.slice(-options.limit)
  const firstUser = options.keepFirstUser
    ? messages.find((message) => message.role === "user")
    : undefined
  const window =
    firstUser && !recent.includes(firstUser) ? [firstUser, ...recent] : recent

  let room = options.byteBudget ?? requestByteBudget
  for (const message of window) {
    for (const part of message.parts) {
      if (part.type !== "file") room -= partBytes(part)
    }
  }

  const sent = [...window]
  for (let index = sent.length - 1; index >= 0; index -= 1) {
    const message = sent[index]
    if (!message) continue
    const newest = index === sent.length - 1
    const parts = message.parts.map((part) => {
      if (part.type !== "file") return part
      const bytes = partBytes(part)
      if (newest || bytes <= room) {
        room -= bytes
        return part
      }
      const name = part.filename?.trim() || "An earlier file"
      return {
        type: "text" as const,
        text: `${name} was attached earlier and is no longer available. Ask for it again if you need it.`,
      }
    })
    sent[index] = { ...message, parts }
  }
  return sent
}

/** An interview turn sends only the new answer. The server keeps the transcript. */
export function interviewRequest(messages: readonly UIMessage[]) {
  return messages.slice(-1)
}
