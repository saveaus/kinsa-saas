import type { PracticeStandard } from "@/lib/ndis-practice-standards"

export function libraryPolicy(standard: PracticeStandard) {
  const body = [
    standard.name,
    "",
    `This policy sets out how the organisation meets “${standard.name}” in the ${standard.module}.`,
    "It applies to the workers and participants of this organisation.",
    "It counts toward the audit pack only after a person accepts it, and someone acknowledges it or an accepted record is kept against it.",
    "A draft does not count. Review it again on the review date.",
  ].join("\n")

  return {
    name: standard.name.slice(0, 160),
    body,
  }
}
