import { redirect } from "next/navigation"

import { ActionForm } from "@/components/action-form"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requireTenant } from "@/lib/tenant"
import { uploadDocumentAction } from "@/modules/documents/actions"
import { documentReviewLabel, documentReviewTone } from "@/modules/documents/assist-decision"
import { listDocumentsForWorker, listEnabledTypes } from "@/modules/documents/queries"

export default async function MyDocumentsPage() {
  const { context } = await requireTenant()
  if (!context.workerId) redirect("/me")

  const [documents, types] = await Promise.all([
    listDocumentsForWorker(context, context.workerId),
    listEnabledTypes(context),
  ])

  return (
    <div className="grid gap-4">
      <RecordTable
        title="Your documents"
        columns={[
          { id: "type", label: "Type" },
          { id: "status", label: "Status" },
          { id: "expiry", label: "Expiry" },
          { id: "file", label: "File", locked: true },
        ]}
        rows={documents.map((doc): RecordRow => {
          const type = doc.document_type_versions as unknown as { name: string }
          return {
            id: doc.id,
            cells: {
              type: { kind: "text", text: type.name },
              status: {
                kind: "chip",
                text: documentReviewLabel(doc.approval_status, doc.flagged),
                tone: documentReviewTone(doc.approval_status, doc.flagged),
              },
              expiry: { kind: "text", text: doc.expires_on ?? "—" },
              file: { kind: "document", text: "View", documentId: doc.id },
            },
          }
        })}
        empty="No documents"
        emptyDescription="Upload a PDF or photo below. The assistant checks it, and anything it cannot approve waits for a person."
      />
      <ActionForm action={uploadDocumentAction.bind(null, context.workerId)} submitLabel="Upload">
        <div className="grid gap-1.5">
          <Label>Type</Label>
          <select
            name="document_type_version_id"
            required
            className="h-8 rounded-lg border border-input px-2.5 text-sm"
          >
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Expiry</Label>
          <Input name="expires_on" type="date" />
        </div>
        <Input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
      </ActionForm>
    </div>
  )
}
