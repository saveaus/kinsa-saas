import type { RecordRow } from "@/components/record-table"
import { personName } from "@/lib/person-name"
import { expiryLabel } from "@/lib/expiry-label"
import type { ComplianceItem } from "@/modules/documents/compliance"

type Bucket = "lapsing" | "pending" | "noncompliant"

export type AttentionRow = RecordRow & {
  bucket: Bucket
  kind: ComplianceItem["kind"]
}

export const attentionColumns = [
  { id: "worker", label: "Worker" },
  { id: "item", label: "Item" },
  { id: "status", label: "Status" },
  { id: "detail", label: "Detail" },
]

function statusText(status: ComplianceItem["status"]) {
  switch (status) {
    case "met":
      return "Current"
    case "lapsing":
      return "Lapsing"
    case "pending":
      return "Pending review"
    case "expired":
      return "Expired"
    case "missing":
      return "Missing"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

function bucketFor(status: ComplianceItem["status"]): Bucket {
  switch (status) {
    case "lapsing":
      return "lapsing"
    case "pending":
      return "pending"
    case "expired":
    case "missing":
    case "met":
      return "noncompliant"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

export function attentionRows(
  workforce: Array<{
    worker: { id: string; first_name: string; last_name: string }
    compliance: { items: ComplianceItem[] }
  }>,
  lapsingWindowDays: number
): AttentionRow[] {
  return workforce.flatMap(({ worker, compliance }) =>
    compliance.items
      .filter((item) => item.status !== "met")
      .map((item) => {
        const href =
          item.kind === "course"
            ? `/workers/${worker.id}`
            : item.status === "pending"
              ? "/approvals"
              : `/workers/${worker.id}#upload`
        const row: AttentionRow = {
          id: `${worker.id}:${item.key}`,
          bucket: bucketFor(item.status),
          kind: item.kind,
          cells: {
            worker: {
              kind: "link",
              text: personName(worker.first_name, worker.last_name),
              href: `/workers/${worker.id}`,
            },
            item: { kind: "link", text: item.label, href },
            status: {
              kind: "item",
              status: item.status,
              text: statusText(item.status),
            },
            detail: {
              kind: "text",
              text:
                item.kind === "course" &&
                (item.status === "expired" || item.status === "lapsing")
                  ? expiryLabel(item.expiresOn, lapsingWindowDays)
                  : item.kind === "course"
                    ? "Course not completed"
                    : expiryLabel(item.expiresOn, lapsingWindowDays),
            },
          },
        }
        return row
      })
  )
}
