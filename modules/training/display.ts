export function enrolmentStatusTone(status: string) {
  if (status === "completed") return "green" as const
  if (status === "in_progress") return "blue" as const
  return "gray" as const
}

export function enrolmentStatusLabel(status: string) {
  if (status === "completed") return "Completed"
  if (status === "in_progress") return "In progress"
  return "Not started"
}

export function lessonPercent(reached: number, steps: number, status: string) {
  if (status === "completed") return 100
  if (steps <= 0) return 0
  return Math.round((Math.min(reached, steps) / steps) * 100)
}

const FAMILIES: Record<string, string> = {
  RR: "Rights and responsibilities",
  GO: "Governance and operations",
  PS: "Provision of supports",
  SE: "Support environment",
  AS: "All staff",
  CC: "Complex care",
  ST: "Condition-specific",
  B: "Bites",
  CP: "Checkpoints",
  H: "Resource hubs",
}

export const courseFamilyOrder = [
  "Rights and responsibilities",
  "Governance and operations",
  "Provision of supports",
  "Support environment",
  "All staff",
  "Complex care",
  "Condition-specific",
  "Bites",
  "Checkpoints",
  "Resource hubs",
  "Other",
] as const

export function courseFamily(code: string | null) {
  if (!code) return "Other"
  return FAMILIES[code.split("-")[0]] ?? "Other"
}

export function courseKindLabel(kind: string) {
  if (kind === "bite") return "Bite"
  if (kind === "checkpoint") return "Checkpoint"
  if (kind === "hub") return "Resource hub"
  return "Course"
}

export function renewalLabel(months: number | null) {
  if (months === 12) return "Renews annually"
  if (months != null) return `Renews every ${months} months`
  return null
}

const COMPLEX_CARE_SKILLS: Record<number, string> = {
  1: "Complex bowel care",
  2: "Enteral feeding",
  3: "Severe dysphagia",
  4: "Ventilation support",
  5: "Tracheostomy",
  6: "Urinary catheter",
  7: "Subcutaneous injections",
  8: "Complex wound",
  9: "Diabetes management",
}

const MEDICATION_CODES = new Set(["SE-11", "CP-05", "B-15", "B-24", "B-25"])

export function practicalSignOff(code: string | null) {
  if (!code) return null
  const [prefix, rawNumber] = code.split("-")
  const number = Number(rawNumber)
  if (prefix === "CC") {
    const name = COMPLEX_CARE_SKILLS[number]
    if (!name) return null
    return {
      name,
      note: `This is theory. ${name} is signed off separately by a qualified health practitioner.`,
    }
  }
  if (MEDICATION_CODES.has(code)) {
    return {
      name: "Medication",
      note: "This is theory. It does not replace the medication observation.",
    }
  }
  const manualHandling =
    (prefix === "SE" && number >= 6 && number <= 10) ||
    code === "CP-04" ||
    (prefix === "B" && number >= 17 && number <= 23)
  if (manualHandling) {
    return {
      name: "Manual handling",
      note: "This is theory. It does not replace practical observation of the transfer.",
    }
  }
  return null
}
