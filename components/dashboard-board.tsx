"use client"

import Link from "next/link"
import { useState } from "react"

import { RecordTable, type RecordRow } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
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

  return (
    <div className="grid gap-6">
      <WorkforceChart
        counts={counts}
        active={focus}
        onSelect={(key) => setFocus((current) => (current === key ? null : key))}
      />
      <RecordTable
        title="Courses"
        columns={columns}
        rows={courses}
        empty={workerCount === 0 ? "No workers yet" : "Nothing needs attention"}
        emptyDescription={
          workerCount === 0
            ? "Add a worker, then assign courses from the library."
            : "Course gaps for the workforce show up here."
        }
        pageSize={8}
        actions={
          <Link href="/courses" className={buttonVariants({ size: "sm", variant: "outline" })}>
            Open library
          </Link>
        }
      />
      <RecordTable
        title="Documents"
        columns={columns}
        rows={documents}
        empty={workerCount === 0 ? "No workers yet" : "Nothing needs attention"}
        emptyDescription={
          workerCount === 0
            ? "Add a worker, then collect the documents each role needs."
            : "Document gaps for the workforce show up here."
        }
        pageSize={8}
      />
    </div>
  )
}
