import { NextResponse } from "next/server"

import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { computeWorkerCompliance } from "@/modules/documents/compliance"
import {
  getLapsingWindowDays,
  listDocumentsForWorker,
  listEnabledTypes,
} from "@/modules/documents/queries"
import { workerCsv } from "@/modules/reports/export"
import { workerPdf } from "@/modules/reports/pdf"
import { courseLapsed, renewalExpiryLabel } from "@/modules/training/renewal"
import { listWorkerEnrolments } from "@/modules/training/queries"
import { getWorker } from "@/modules/workers/queries"
import { attachRequirementRoles, listRequirementMaps } from "@/modules/workforce/requirements"
import { asStaffRoles } from "@/modules/workforce/roles"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "reports.export")

  const worker = await getWorker(context, id)
  if (!worker) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const [types, documents, enrolments, lapsingWindowDays, requirementMaps] = await Promise.all([
    listEnabledTypes(context),
    listDocumentsForWorker(context, id),
    listWorkerEnrolments(context, id),
    getLapsingWindowDays(context),
    listRequirementMaps(context),
  ])
  const supabase = await createServerSupabase()
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("organisation_id", context.organisationId)
    .eq("status", "published")
  const scoped = attachRequirementRoles(courses ?? [], types, requirementMaps)
  const enrolmentIds = enrolments.map((enrolment) => enrolment.id)
  const { data: completions } =
    enrolmentIds.length === 0
      ? { data: [] }
      : await supabase
          .from("completions")
          .select("enrolment_id, score, passed")
          .in("enrolment_id", enrolmentIds)

  const compliance = computeWorkerCompliance({
    workerId: worker.id,
    workerRoles: asStaffRoles(worker.staff_roles),
    types: scoped.types,
    documents,
    courses: scoped.courses,
    enrolments,
    lapsingWindowDays,
  })

  const format = new URL(request.url).searchParams.get("format")
  await recordAudit("report.exported", "worker", worker.id, {
    scope: "worker",
    format: format === "pdf" ? "pdf" : "csv",
  })

  const payload = {
    worker,
    organisationName: context.organisationName,
    compliance,
    documents: documents.map((doc) => ({
      typeName: (doc.document_type_versions as unknown as { name: string }).name,
      approval_status: doc.approval_status,
      expires_on: doc.expires_on,
      original_filename: doc.original_filename,
      reviewer: doc.reviewed_by,
    })),
    courses: enrolments.map((enrolment) => {
      const course = enrolment.courses as unknown as { title: string; renewal_months: number | null }
      const completion = (completions ?? []).find((row) => row.enrolment_id === enrolment.id && row.score != null)
      const lapsed = enrolment.status === "completed" && courseLapsed(enrolment.completed_at, course.renewal_months)
      return {
        title: course.title,
        status: lapsed ? "renewal due" : enrolment.status,
        score: completion?.score != null ? `${completion.score}%` : "",
        completedOn: enrolment.completed_at ? enrolment.completed_at.slice(0, 10) : "",
        validUntil: renewalExpiryLabel(enrolment.completed_at, course.renewal_months) ?? "",
      }
    }),
  }
  const stem = `kinsa-compliance-evidence-${worker.last_name.toLowerCase()}`

  if (format === "pdf") {
    const buffer = await workerPdf(payload)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${stem}.pdf"`,
      },
    })
  }

  return new NextResponse(workerCsv(payload), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stem}.csv"`,
    },
  })
}
