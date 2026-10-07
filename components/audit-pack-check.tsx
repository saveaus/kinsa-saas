import Link from "next/link"

import { RecordTable, type RecordRow } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
import type { ChipTone } from "@/components/chip"
import {
  packAreaLabel,
  packGaps,
  packStatusLabel,
  type PackItem,
  type PackStatus,
} from "@/modules/audit-pack/score"

function packTone(status: PackStatus): ChipTone {
  switch (status) {
    case "met":
      return "green"
    case "lapsing":
      return "yellow"
    case "missing":
      return "red"
    case "overdue":
      return "red"
    case "unaccepted":
      return "gray"
    default: {
      const unreachable: never = status
      return unreachable
    }
  }
}

export function AuditPackCheck({
  items,
  needsGroups,
  downloadHref,
  preview,
  moreHref,
}: {
  items: PackItem[]
  needsGroups: boolean
  downloadHref?: string
  preview?: number
  moreHref?: string
}) {
  const rows: RecordRow[] = packGaps(items).map((item) => ({
    id: item.key,
    cells: {
      item: { kind: "link", text: item.label, href: item.href },
      area: { kind: "text", text: packAreaLabel(item.area) },
      status: {
        kind: "chip",
        text: packStatusLabel(item.status),
        tone: packTone(item.status),
      },
      detail: { kind: "text", text: item.detail },
    },
  }))

  return (
    <div className="grid gap-3">
      {needsGroups ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/settings/general" className="text-primary underline">
            Add registration groups
          </Link>{" "}
          so the checklist matches the standards this organisation is audited
          on. A verification provider is not scored on high-intensity or
          behaviour-support standards.
        </p>
      ) : null}
      <RecordTable
        title="Today's check"
        actions={
          downloadHref ? (
            <Link
              href={downloadHref}
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Download pack
            </Link>
          ) : null
        }
        columns={[
          { id: "item", label: "Item" },
          { id: "area", label: "Area" },
          { id: "status", label: "Status" },
          { id: "detail", label: "Detail" },
        ]}
        rows={rows}
        empty="Nothing is missing, lapsing, or overdue"
        emptyDescription="Accepted evidence with a current review or expiry date is ready."
        pageSize={preview}
        moreHref={moreHref}
      />
    </div>
  )
}
