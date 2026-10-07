import { RecordTable, type RecordRow } from "@/components/record-table"
import { personName } from "@/lib/person-name"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { documentReviewLabel } from "@/modules/documents/assist-decision"
import { listPendingDocuments } from "@/modules/documents/queries"

export default async function ApprovalsPage() {
  const { context } = await requireTenant()
  requirePermission(context, "documents.approve")
  const pending = await listPendingDocuments(context)

  const rows: RecordRow[] = pending.map((doc) => {
    const worker = doc.workers as unknown as {
      first_name: string
      last_name: string
    }
    const type = doc.document_type_versions as unknown as { name: string }
    return {
      id: doc.id,
      cells: {
        worker: {
          kind: "text",
          text: personName(worker.first_name, worker.last_name),
        },
        type: { kind: "text", text: type.name },
        file: { kind: "text", text: doc.original_filename },
        expiry: { kind: "text", text: doc.expires_on ?? "—" },
        status: {
          kind: "review",
          text: documentReviewLabel(doc.approval_status, false),
          documentId: doc.id,
          status: doc.approval_status,
        },
        note: { kind: "text", text: doc.review_note ?? "—" },
        document: { kind: "document", text: "View", documentId: doc.id },
      },
    }
  })

  return (
    <RecordTable
      title="Approval queue"
      columns={[
        { id: "worker", label: "Worker" },
        { id: "type", label: "Type" },
        { id: "file", label: "File" },
        { id: "expiry", label: "Expiry" },
        { id: "status", label: "Status" },
        { id: "note", label: "Note" },
        { id: "document", label: "Document", locked: true },
      ]}
      rows={rows}
      empty="Nothing to review"
      emptyDescription="Documents the assistant cannot approve show up here for a person to check."
    />
  )
}
