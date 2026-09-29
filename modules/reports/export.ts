import { format } from "date-fns"

import type { WorkerCompliance } from "@/modules/documents/compliance"

type WorkerRow = {
  first_name: string
  last_name: string
  email: string
}

export function organisationCsv(
  rows: Array<{ worker: WorkerRow; compliance: WorkerCompliance }>
) {
  const header = ["Worker", "Email", "Status", "Score", "Exceptions"]
  const lines = rows.map(({ worker, compliance }) => {
    const exceptions = compliance.items
      .filter((item) => item.status !== "met")
      .map((item) => `${item.label}: ${item.status}`)
      .join("; ")
    return [
      `${worker.first_name} ${worker.last_name}`,
      worker.email,
      compliance.overall,
      `${compliance.percent}%`,
      exceptions,
    ]
      .map(csvCell)
      .join(",")
  })
  return [header.join(","), ...lines].join("\n")
}

export function workerCsv(input: {
  worker: WorkerRow
  organisationName: string
  compliance: WorkerCompliance
  documents: Array<{
    typeName: string
    approval_status: string
    expires_on: string | null
    original_filename: string
    reviewer?: string | null
  }>
  courses: Array<{
    title: string
    status: string
    score: string
    completedOn: string
    validUntil: string
  }>
}) {
  const lines = [
    `Organisation,${csvCell(input.organisationName)}`,
    `Worker,${csvCell(`${input.worker.first_name} ${input.worker.last_name}`)}`,
    `Email,${csvCell(input.worker.email)}`,
    `Generated,${csvCell(format(new Date(), "yyyy-MM-dd"))}`,
    `Overall,${csvCell(input.compliance.overall)}`,
    "",
    "Item,Kind,Status,Expiry",
    ...input.compliance.items.map((item) =>
      [item.label, item.kind, item.status, item.expiresOn ?? ""].map(csvCell).join(",")
    ),
    "",
    "Document,Approval,Expiry,Reviewer,File",
    ...input.documents.map((doc) =>
      [
        doc.typeName,
        doc.approval_status,
        doc.expires_on ?? "",
        doc.reviewer ?? "",
        doc.original_filename,
      ]
        .map(csvCell)
        .join(",")
    ),
    "",
    "Course,Status,Score,Completed,Valid until",
    ...input.courses.map((course) =>
      [course.title, course.status, course.score, course.completedOn, course.validUntil].map(csvCell).join(",")
    ),
  ]
  return lines.join("\n")
}

function csvCell(value: string) {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`
  }
  return value
}
