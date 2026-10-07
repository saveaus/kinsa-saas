export type RosterTeam = { code: string; name: string }

export type RosterRow = {
  firstName: string
  lastName: string
  email: string
  roles: string[]
}

const builtInPhrases: { code: string; phrases: string[] }[] = [
  { code: "complex_care", phrases: ["complex care", "high intensity", "complex"] },
  { code: "leader", phrases: ["team leader", "coordinator", "director", "supervisor", "manager", "leader"] },
  { code: "office", phrases: ["administration", "admin", "finance", "roster", "office"] },
  { code: "support", phrases: ["disability support", "support worker", "support"] },
]

export function parseRoster(text: string, teams: readonly RosterTeam[]) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) return { rows: [] as RosterRow[], skipped: 0 }

  const delimiter = detectDelimiter(lines[0] ?? "")
  const table = lines.map((line) => splitRow(line, delimiter))
  const header = table[0] ?? []
  const kinds = header.map(headerKind)
  const hasHeader = kinds.some((kind) => kind !== "other")
  const body = hasHeader ? table.slice(1) : table
  const column = hasHeader ? indexByKind(kinds) : detectColumns(body)

  const rows: RosterRow[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const cells of body) {
    const email = cell(cells, column.email).toLowerCase()
    const named = namedPerson(cells, column)
    if (!isEmail(email) || !named) {
      skipped += 1
      continue
    }
    if (seen.has(email)) {
      skipped += 1
      continue
    }
    seen.add(email)
    rows.push({
      firstName: named.firstName,
      lastName: named.lastName,
      email,
      roles: rolesFor(cell(cells, column.role), teams),
    })
  }

  return { rows, skipped }
}

export function rolesFor(value: string, teams: readonly RosterTeam[]) {
  const parts = value
    .split(/[,;/|]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  const matched = parts
    .map((part) => roleFor(part, teams))
    .filter((code): code is string => Boolean(code))
  const unique = [...new Set(matched)]
  if (unique.length > 0) return unique
  return defaultRoles(teams)
}

function defaultRoles(teams: readonly RosterTeam[]) {
  const support = teams.find((team) => team.code === "support")
  const fallback = support ?? teams[0]
  return fallback ? [fallback.code] : []
}

function roleFor(value: string, teams: readonly RosterTeam[]) {
  const text = normalize(value)
  const exact = teams.find(
    (team) => normalize(team.name) === text || team.code === text.replace(/ /g, "_")
  )
  if (exact) return exact.code

  let best: { code: string; length: number } | null = null
  for (const team of teams) {
    const name = normalize(team.name)
    if (name && hasPhrase(text, name) && (!best || name.length > best.length)) {
      best = { code: team.code, length: name.length }
    }
  }
  for (const built of builtInPhrases) {
    if (!teams.some((team) => team.code === built.code)) continue
    for (const phrase of built.phrases) {
      if (hasPhrase(text, phrase) && (!best || phrase.length > best.length)) {
        best = { code: built.code, length: phrase.length }
      }
    }
  }
  return best?.code ?? null
}

function namedPerson(
  cells: string[],
  column: { first: number; last: number; name: number }
) {
  if (column.first >= 0 || column.last >= 0) {
    const firstName = cell(cells, column.first)
    const lastName = cell(cells, column.last)
    if (!firstName || !lastName) return null
    return { firstName, lastName }
  }
  return splitName(cell(cells, column.name))
}

function splitName(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim()
  if (!cleaned) return null
  if (cleaned.includes(",")) {
    const [last, first] = cleaned.split(",").map((part) => part.trim())
    const firstName = first?.split(" ")[0]
    if (firstName && last) return { firstName, lastName: last }
  }
  const parts = cleaned.split(" ")
  if (parts.length < 2) return null
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") }
}

type HeaderKind = "email" | "first" | "last" | "name" | "role" | "other"

function headerKind(value: string): HeaderKind {
  const text = normalize(value)
  if (!text) return "other"
  if (text.includes("email") || text.includes("e mail")) return "email"
  if (text === "first" || text === "first name" || text === "given name" || text === "firstname") {
    return "first"
  }
  if (
    text === "last" ||
    text === "last name" ||
    text === "surname" ||
    text === "family name" ||
    text === "lastname"
  ) {
    return "last"
  }
  if (
    text === "name" ||
    text === "full name" ||
    text === "worker" ||
    text === "worker name" ||
    text === "staff" ||
    text === "staff name" ||
    text === "employee" ||
    text === "employee name"
  ) {
    return "name"
  }
  if (
    text === "role" ||
    text === "roles" ||
    text === "team" ||
    text === "teams" ||
    text === "position" ||
    text === "job title" ||
    text === "job"
  ) {
    return "role"
  }
  return "other"
}

function indexByKind(kinds: HeaderKind[]) {
  return {
    email: kinds.indexOf("email"),
    first: kinds.indexOf("first"),
    last: kinds.indexOf("last"),
    name: kinds.indexOf("name"),
    role: kinds.indexOf("role"),
  }
}

function detectColumns(rows: string[][]) {
  const width = Math.max(0, ...rows.map((row) => row.length))
  let email = -1
  let most = 0
  for (let index = 0; index < width; index += 1) {
    const count = rows.map((row) => row[index] ?? "").filter(isEmail).length
    if (count > most) {
      email = index
      most = count
    }
  }
  let name = email === 0 ? 1 : 0
  if (name === email) name = -1
  return { email, first: -1, last: -1, name, role: -1 }
}

function cell(cells: string[], index: number) {
  if (index < 0) return ""
  return (cells[index] ?? "").trim()
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function detectDelimiter(line: string) {
  const counts = [
    { delimiter: "\t", count: splitRow(line, "\t").length },
    { delimiter: ";", count: splitRow(line, ";").length },
    { delimiter: ",", count: splitRow(line, ",").length },
  ]
  counts.sort((left, right) => right.count - left.count)
  return counts[0]?.count && counts[0].count > 1 ? counts[0].delimiter : ","
}

function splitRow(line: string, delimiter: string) {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char ?? ""
  }
  cells.push(current.trim())
  return cells
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function hasPhrase(text: string, phrase: string) {
  if (!phrase) return false
  return ` ${text} `.includes(` ${phrase} `)
}
