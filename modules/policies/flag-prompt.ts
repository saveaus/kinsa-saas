export function policyFlagPrompt(policy: {
  id: string
  name: string
  standardName: string
  note: string | null
}) {
  const lines = [
    `Why isn't "${policy.name}" compliant with the current ${policy.standardName} standard?`,
  ]
  if (policy.note) lines.push(`The check noted: ${policy.note}`)
  lines.push("Explain why, then suggest the changes.")
  lines.push(`Policy id: ${policy.id}`)
  return lines.join("\n")
}

export function isPolicyFlagPrompt(text: string) {
  return (
    text.startsWith("Why isn't \"") &&
    text.includes("compliant with the current")
  )
}

export function policyFlagId(text: string) {
  const match = text.match(
    /Policy id: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  )
  return match?.[1] ?? null
}

export function messageText(parts: readonly { type: string; text?: string }[]) {
  return parts
    .flatMap((part) => (part.type === "text" && part.text ? [part.text] : []))
    .join("")
    .trim()
}
