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
