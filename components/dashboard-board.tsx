"use client"

import Link from "next/link"
import { useState } from "react"

import { AttioReport } from "@/components/attio-report"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { buttonVariants } from "@/components/ui/button"
import { attentionColumns } from "@/components/workforce-attention"
import { WorkforceChart } from "@/components/workforce-chart"
import type { ReportModel } from "@/modules/analytics/reports"

type Bucket = "compliant" | "lapsing" | "pending" | "noncompliant"

export function DashboardBoard({
  counts,
  reports,
  courseRows,
  documentRows,
  approvalRows,
  workerCount,
}: {
  counts: Record<Bucket, number>
  reports: ReportModel[]
  courseRows: Array<RecordRow & { bucket: Bucket }>
  documentRows: Array<RecordRow & { bucket: Bucket }>
  approvalRows: RecordRow[]
  workerCount: number
}) {
  const [focus, setFocus] = useState<Bucket | null>(null)
  const courses = focus
    ? courseRows.filter((row) => row.bucket === focus)
    : courseRows
  const documents = focus
    ? documentRows.filter((row) => row.bucket === focus)
    : documentRows

  return (
    <div className="grid gap-6">
      <div className="grid items-stretch gap-3 lg:grid-cols-3">
        {reports.map((report) => (
          <AttioReport key={report.id} report={report} height={168} />
        ))}
        <WorkforceChart
          counts={counts}
          active={focus}
          onSelect={(key) =>
            setFocus((current) => (current === key ? null : key))
          }
        />
      </div>
      <RecordTable
        title="Courses"
        columns={attentionColumns}
        rows={courses}
        empty={workerCount === 0 ? "No workers yet" : "Nothing needs attention"}
        emptyDescription={
          workerCount === 0
            ? "Add a worker, then assign courses from the library."
            : "Course gaps for the workforce show up here."
        }
        pageSize={8}
        moreHref="/courses/outstanding"
        actions={
          <Link
            href="/courses"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Open library
          </Link>
        }
      />
      <RecordTable
        title="Documents"
        columns={attentionColumns}
        rows={documents}
        empty={workerCount === 0 ? "No workers yet" : "Nothing needs attention"}
        emptyDescription={
          workerCount === 0
            ? "Add a worker, then collect the documents each role needs."
            : "Document gaps for the workforce show up here."
        }
        pageSize={8}
        moreHref="/workers/documents"
      />
      <RecordTable
        title="Approvals"
        columns={[
          { id: "worker", label: "Worker" },
          { id: "type", label: "Type" },
          { id: "file", label: "File" },
          { id: "expiry", label: "Expiry" },
          { id: "document", label: "Document", locked: true },
          { id: "review", label: "Review", locked: true },
        ]}
        rows={approvalRows}
        empty="Nothing to review"
        emptyDescription="Uploaded documents that need a decision show up here."
        pageSize={8}
        moreHref="/approvals"
      />
    </div>
  )
}
