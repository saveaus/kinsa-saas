const reservedCodes = new Set(["support", "complex_care", "leader", "office"])
const codePattern = /^[a-z][a-z0-9_]{0,39}$/

export function teamCodeFromName(name: string, taken: Iterable<string>) {
  const used = new Set(taken)
  const raw = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
  let base = raw
    .replace(/^[^a-z]+/, "")
    .slice(0, 32)
    .replace(/_+$/g, "")
  if (!base) base = "team"

  let candidate = base
  let n = 2
  while (
    reservedCodes.has(candidate) ||
    used.has(candidate) ||
    !codePattern.test(candidate)
  ) {
    const suffix = `_${n}`
    candidate = `${base.slice(0, 40 - suffix.length)}${suffix}`
    n += 1
    if (n > 200) break
  }
  return candidate
}
