import type { UIMessage } from "ai"

const charsPerToken = 4
const attachedFileChars = 4000

/** A rough size for a prompt whose real usage never came back, such as after Stop. */
export function promptChars(instructions: string, messages: readonly UIMessage[]) {
  let chars = instructions.length
  for (const message of messages) {
    for (const part of message.parts) {
      if (part.type === "text") chars += part.text.length
      else if (part.type === "file") chars += attachedFileChars
    }
  }
  return chars
}

/**
 * What a turn cost. The provider's total wins. An interrupted turn has no total,
 * so it pays for finished steps plus an estimate for the step that was running,
 * never more than was claimed unless finished steps already went past it.
 */
export function settledTokens(input: {
  claimed: number
  total: number | null | undefined
  stepTokens: readonly (number | null | undefined)[]
  aborted: boolean
  promptChars: number
  partialChars: number
}) {
  if (input.total != null) return Math.max(0, input.total)
  const completed = input.stepTokens.reduce<number>((sum, step) => sum + (step ?? 0), 0)
  if (!input.aborted && input.partialChars === 0) {
    // A failed turn with no reply sent nothing back. A finished one that hid its usage keeps the claim.
    return input.stepTokens.length > 0 && completed === 0 ? input.claimed : completed
  }
  const running = Math.ceil((input.promptChars + input.partialChars) / charsPerToken)
  return Math.min(completed + running, Math.max(input.claimed, completed))
}
