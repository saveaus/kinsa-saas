export type EvidenceWorker = {
  id: string
  firstName: string
  lastName: string
}

export type EvidenceType = {
  id: string
  code: string
  name: string
}

export type EvidenceMatch = {
  workerId: string | null
  typeId: string | null
  expiresOn: string | null
}

const typePhrases: Record<string, string[]> = {
  ndis_worker_screening: ["ndis worker screening", "worker screening", "ndis screening", "ndisws"],
  wwcc: ["working with children", "wwcc", "blue card"],
  first_aid: ["first aid", "hltaid011"],
  cpr: ["hltaid009", "cpr"],
  driver_licence: ["drivers licence", "driver licence", "drivers license", "driver license"],
  police_check: ["national police", "police check", "police certificate"],
  ndis_orientation: ["ndis worker orientation", "worker orientation", "orientation module"],
  qualification: ["certificate iv", "certificate iii", "cert iv", "cert iii", "qualification"],
  right_to_work: ["right to work", "citizenship", "passport", "vevo", "visa"],
  immunisation: ["immunisation", "immunization", "vaccination"],
  vehicle_insurance: ["vehicle insurance", "car insurance"],
  vehicle_registration: ["vehicle registration", "car registration"],
  ahpra: ["ahpra"],
  practical_competency: ["practical competency"],
  signoff_bowel: ["bowel"],
  signoff_enteral: ["enteral", "peg"],
  signoff_dysphagia: ["dysphagia", "swallowing"],
  signoff_ventilation: ["ventilation", "ventilator"],
  signoff_tracheostomy: ["tracheostomy", "trache"],
  signoff_catheter: ["catheter"],
  signoff_injection: ["subcutaneous"],
  signoff_wound: ["complex wound", "wound"],
  signoff_medication: ["medication"],
  signoff_manual_handling: ["manual handling"],
  signoff_diabetes: ["diabetes"],
}

export function matchEvidence(
  filename: string,
  workers: readonly EvidenceWorker[],
  types: readonly EvidenceType[]
): EvidenceMatch {
  const text = normalize(filename)
  return {
    workerId: matchWorker(text, workers),
    typeId: matchType(text, types),
    expiresOn: expiryFromFilename(filename),
  }
}

export function expiryFromFilename(filename: string) {
  const text = normalize(filename).replace(/\s+/g, "-")
  const found: string[] = []
  for (const match of filename.matchAll(/\b(20\d{2})[-./](\d{2})[-./](\d{2})\b/g)) {
    const iso = isoDate(match[1] ?? "", match[2] ?? "", match[3] ?? "")
    if (iso) found.push(iso)
  }
  for (const match of text.matchAll(/\b(\d{1,2})-(\d{1,2})-(20\d{2})\b/g)) {
    const iso = isoDate(match[3] ?? "", match[2] ?? "", match[1] ?? "")
    if (iso) found.push(iso)
  }
  found.sort()
  return found.at(-1) ?? null
}

function matchWorker(text: string, workers: readonly EvidenceWorker[]) {
  const hits = workers.filter((worker) => {
    const full = normalize(`${worker.firstName} ${worker.lastName}`)
    const reversed = normalize(`${worker.lastName} ${worker.firstName}`)
    return hasPhrase(text, full) || (reversed !== full && hasPhrase(text, reversed))
  })
  return hits.length === 1 ? (hits[0]?.id ?? null) : null
}

function matchType(text: string, types: readonly EvidenceType[]) {
  let winner: { id: string; length: number } | null = null
  let tie = false
  for (const type of types) {
    const phrases = [normalize(type.name), ...(typePhrases[type.code] ?? [])]
    for (const phrase of phrases) {
      if (!phrase || !hasPhrase(text, phrase)) continue
      if (!winner || phrase.length > winner.length) {
        winner = { id: type.id, length: phrase.length }
        tie = false
      } else if (phrase.length === winner.length && type.id !== winner.id) {
        tie = true
      }
    }
  }
  if (!winner || tie) return null
  return winner.id
}

function isoDate(year: string, month: string, day: string) {
  if (!year || !month || !day) return null
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getUTCFullYear() !== Number(year)) return null
  if (parsed.getUTCMonth() + 1 !== Number(month)) return null
  if (parsed.getUTCDate() !== Number(day)) return null
  return iso
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,5}$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

function hasPhrase(text: string, phrase: string) {
  if (!phrase) return false
  return ` ${text} `.includes(` ${phrase} `)
}
