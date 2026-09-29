"use client"

import { useState } from "react"

import { RecordTable, type RecordRow } from "@/components/record-table"
import { WorkforceChart } from "@/components/workforce-chart"

type Bucket = "compliant" | "lapsing" | "pending" | "noncompliant"

const columns = [
  { id: "worker", label: "Worker" },
  { id: "item", label: "Item" },
  { id: "status", label: "Status" },
  { id: "detail", label: "Detail" },
]

export function DashboardBoard({
  counts,
  courseRows,
  documentRows,
  workerCount,
}: {
  counts: Record<Bucket, number>
  courseRows: Array<RecordRow & { bucket: Bucket }>
  documentRows: Array<RecordRow & { bucket: Bucket }>
  workerCount: number
}) {
  const [focus, setFocus] = useState<Bucket | null>(null)
  const courses = focus ? courseRows.filter((row) => row.bucket === focus) : courseRows
  const documents = focus ? documentRows.filter((row) => row.bucket === focus) : documentRows
  const empty =
    workerCount === 0
      ? "Add a worker to start tracking evidence."
      : focus === "compliant"
        ? "These workers have nothing that needs attention."
        : focus
          ? "Nothing in this status needs attention."
          : "Nothing needs attention."

  return (
    <div className="grid gap-6">
      <WorkforceChart
        counts={counts}
        active={focus}
        onSelect={(key) => setFocus((current) => (current === key ? null : key))}
      />
      <RecordTable title="Courses" columns={columns} rows={courses} empty={empty} pageSize={8} />
      <RecordTable title="Documents" columns={columns} rows={documents} empty={empty} pageSize={8} />
    </div>
  )
}
