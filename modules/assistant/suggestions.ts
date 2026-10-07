const general = [
  "Which area needs attention first?",
  "What should I do next?",
  "What is still missing?",
  "What would an auditor ask first?",
  "Draft a policy for the biggest gap",
  "Who is missing a current document?",
]

function mix(seed: number) {
  let value = seed >>> 0 || 1
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
}

export function promptsForLogin(gaps: string[], seed: number, count = 3) {
  const labels = [...new Set(gaps.map((gap) => gap.trim()).filter((gap) => gap.length > 0))].slice(0, 4)
  const specific = labels.flatMap((label) => [
    `What is still missing for ${label}?`,
    `What should I do about ${label}?`,
  ])
  const random = mix(seed)
  const shuffle = (prompts: string[]) =>
    prompts
      .map((prompt) => ({ prompt, order: random() }))
      .sort((left, right) => left.order - right.order)
      .map((row) => row.prompt)
  const pool = [...shuffle(specific), ...shuffle(general)]
  const picked: string[] = []
  for (const prompt of pool) {
    if (picked.includes(prompt)) continue
    picked.push(prompt)
    if (picked.length === count) break
  }
  return picked
}

export function gapLabelsFromSnapshot(snapshot: string) {
  const section = snapshot.split("First open items:\n")[1]
  if (!section) return []
  return section
    .split("\n")
    .map((line) => line.split(" — ")[0]?.trim() ?? "")
    .filter((label) => label.length > 0)
}
