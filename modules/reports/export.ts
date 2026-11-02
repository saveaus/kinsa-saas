import { csvCell } from "@/lib/csv"
import { format } from "date-fns"

import type { WorkerCompliance } from "@/modules/documents/compliance"
import type { OrganisationEvidence } from "@/modules/reports/dossier"
import { todayOn } from "@/lib/today"

type WorkerRow = {
  first_name: string
  last_name: string
  email: string
}

export function organisationCsv(evidence: OrganisationEvidence) {
  const lines = [
    `Organisation,${csvCell(evidence.organisationName)}`,
    `Registration groups,${csvCell(evidence.groups)}`,
    `Generated,${csvCell(evidence.generatedOn)}`,
    `Audit pack,${csvCell(evidence.readiness)}`,
    "Note,This is evidence, not an audit certificate.",
  ]
  for (const section of evidence.sections) {
    lines.push("", section.title, section.columns.map(csvCell).join(","))
    if (section.rows.length === 0) {
      lines.push(csvCell(section.empty))
      continue
    }
    for (const row of section.rows) lines.push(row.map(csvCell).join(","))
  }
  return lines.join("\n")
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
}) {
  const lines = [
    `Organisation,${csvCell(input.organisationName)}`,
    `Worker,${csvCell(`${input.worker.first_name} ${input.worker.last_name}`)}`,
    `Email,${csvCell(input.worker.email)}`,
    `Generated,${csvCell(todayOn())}`,
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
  ]
  return lines.join("\n")
}
