import Link from "next/link"
import { redirect } from "next/navigation"

import { DashboardBoard } from "@/components/dashboard-board"
import type { RecordRow } from "@/components/record-table"
import { OverallBadge } from "@/components/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { attentionRows } from "@/components/workforce-attention"
import { can, requireTenant } from "@/lib/tenant"
import { summariseWorkforce } from "@/modules/analytics/queries"
import { dashboardReports } from "@/modules/analytics/reports"
import { computeWorkerCompliance } from "@/modules/documents/compliance"
import {
  buildWorkforceCompliance,
  getLapsingWindowDays,
  listDocumentsForWorker,
  listEnabledTypes,
  listPendingDocuments,
} from "@/modules/documents/queries"
import { listWorkerEnrolments } from "@/modules/training/queries"
import {
  attachRequirementRoles,
  listRequirementMaps,
} from "@/modules/workforce/requirements"
import { asStaffRoles } from "@/modules/workforce/roles"
import { createServerSupabase } from "@/lib/supabase/server"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>
}) {
  const { context } = await requireTenant()
  if (!can(context, "workers.read_all")) {
    redirect("/me")
  }

  const params = await searchParams
  const [workforce, lapsingWindowDays, pending] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
    listPendingDocuments(context),
  ])
  const counts = {
    compliant: workforce.filter((row) => row.compliance.overall === "compliant")
      .length,
    lapsing: workforce.filter((row) => row.compliance.overall === "lapsing")
      .length,
    pending: workforce.filter((row) => row.compliance.overall === "pending")
      .length,
    noncompliant: workforce.filter(
      (row) => row.compliance.overall === "noncompliant"
    ).length,
  }

  const attention = attentionRows(workforce, lapsingWindowDays)

  const showWelcome = params.welcome === "1" || workforce.length === 0
  let personal: {
    percent: number
    overall: "compliant" | "lapsing" | "pending" | "noncompliant"
    met: number
    total: number
  } | null = null

  if (context.workerId) {
    const [types, documents, enrolments, lapsingWindowDays, requirementMaps] =
      await Promise.all([
        listEnabledTypes(context),
        listDocumentsForWorker(context, context.workerId),
        listWorkerEnrolments(context, context.workerId),
        getLapsingWindowDays(context),
        listRequirementMaps(context),
      ])
    const supabase = await createServerSupabase()
    const [{ data: courses }, { data: profile }] = await Promise.all([
      supabase
        .from("courses")
        .select("*")
        .eq("organisation_id", context.organisationId)
        .eq("status", "published"),
      supabase
        .from("workers")
        .select("staff_roles")
        .eq("id", context.workerId)
        .maybeSingle(),
    ])
    const scoped = attachRequirementRoles(courses ?? [], types, requirementMaps)
    const compliance = computeWorkerCompliance({
      workerId: context.workerId,
      workerRoles: asStaffRoles(profile?.staff_roles),
      types: scoped.types,
      documents,
      courses: scoped.courses,
      enrolments,
      lapsingWindowDays,
    })
    personal = {
      percent: compliance.percent,
      overall: compliance.overall,
      met: compliance.met,
      total: compliance.total,
    }
  }

  return (
    <div className="grid gap-6">
      {showWelcome ? (
        <section className="grid gap-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="font-heading text-lg">
              Get your organisation ready
            </h2>
            <p className="text-sm text-muted-foreground">
              Your course library is in Courses. Add people, set what each role
              needs, then turn on follow-up emails.
            </p>
          </div>
          <ol className="grid gap-2 text-sm">
            <li>
              <Link
                href="/workers"
                className="font-medium underline-offset-2 hover:underline"
              >
                1. Add a worker
              </Link>
              <span className="text-muted-foreground">
                {" "}
                — name, email, and roles
              </span>
            </li>
            <li>
              <Link
                href="/settings/credentials"
                className="font-medium underline-offset-2 hover:underline"
              >
                2. Check credentials
              </Link>
              <span className="text-muted-foreground">
                {" "}
                — which documents each role must hold
              </span>
            </li>
            <li>
              <Link
                href="/courses"
                className="font-medium underline-offset-2 hover:underline"
              >
                3. Open the course library
              </Link>
              <span className="text-muted-foreground">
                {" "}
                — browse and assign the courses already set up
              </span>
            </li>
            <li>
              <Link
                href="/settings/emails"
                className="font-medium underline-offset-2 hover:underline"
              >
                4. Set automatic emails
              </Link>
              <span className="text-muted-foreground">
                {" "}
                — reminders before things expire
              </span>
            </li>
          </ol>
        </section>
      ) : null}
      {personal ? (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Your compliance</p>
            <p className="text-sm text-muted-foreground">
              {personal.met}/{personal.total} required items current (
              {personal.percent}%)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <OverallBadge overall={personal.overall} />
            <Link
              href="/me"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open
            </Link>
          </div>
        </section>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">Workforce overview</h2>
          <p className="text-sm text-muted-foreground">
            Evidence readiness for {context.organisationName}. This is not an
            audit certificate.
          </p>
        </div>
        {workforce.length === 0 ? (
          <Link href="/workers" className={buttonVariants({ size: "sm" })}>
            Add a worker
          </Link>
        ) : null}
      </div>
      <DashboardBoard
        counts={counts}
        reports={dashboardReports(
          summariseWorkforce(workforce, lapsingWindowDays)
        )}
        courseRows={attention.filter((row) => row.kind === "course")}
        documentRows={attention.filter((row) => row.kind === "document")}
        approvalRows={pending.map((document) => {
          const worker = document.workers as unknown as {
            first_name: string
            last_name: string
          }
          const type = document.document_type_versions as unknown as {
            name: string
          }
          return {
            id: document.id,
            cells: {
              worker: {
                kind: "link" as const,
                text: `${worker.first_name} ${worker.last_name}`,
                href: `/workers/${document.worker_id}`,
              },
              type: { kind: "text" as const, text: type.name },
              file: { kind: "text" as const, text: document.original_filename },
              expiry: {
                kind: "text" as const,
                text: document.expires_on ?? "—",
              },
              document: {
                kind: "document" as const,
                text: "View",
                documentId: document.id,
              },
              review: {
                kind: "review" as const,
                text: "Review",
                documentId: document.id,
              },
            },
          }
        })}
        workerCount={workforce.length}
      />
    </div>
  )
}
