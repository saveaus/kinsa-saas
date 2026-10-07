import { parseRoster, type RosterRow, type RosterTeam } from "@/modules/migration/roster"

export function staffCheckMessage(
  people: { firstName: string; lastName: string; email: string; team: string }[],
  skipped: number
) {
  const shown = people.slice(0, 12).map((person) => `${person.firstName} ${person.lastName}, ${person.email}, ${person.team}`)
  const more = people.length - shown.length
  return [
    "I dropped our staff list. Check it with me before anyone is added.",
    ...shown,
    more > 0 ? `and ${more} more` : "",
    skipped === 1 ? "1 row had no email and was left out." : "",
    skipped > 1 ? `${skipped} rows had no email and were left out.` : "",
    "Tell me if anything looks wrong. I will add them when I say so.",
  ]
    .filter(Boolean)
    .join("\n")
}

export function certificateCheckMessage(
  files: { name: string; worker: string | null; type: string | null }[]
) {
  const ready = files.filter((file) => file.worker && file.type)
  const waiting = files.length - ready.length
  const shown = ready.slice(0, 12).map((file) => `${file.name} → ${file.worker}, ${file.type}`)
  return [
    "I dropped certificates. Check them with me before they are filed.",
    ...shown,
    ready.length > shown.length ? `and ${ready.length - shown.length} more` : "",
    waiting === 1 ? "1 file still needs a worker or a type." : "",
    waiting > 1 ? `${waiting} files still need a worker or a type.` : "",
    "Tell me if a file is on the wrong person. I will file them when I say so.",
  ]
    .filter(Boolean)
    .join("\n")
}

export function teamLabel(roles: string[], teams: readonly RosterTeam[]) {
  const names = roles.map((role) => teams.find((team) => team.code === role)?.name ?? role)
  return names.filter(Boolean).join(", ")
}

export type { RosterRow }
