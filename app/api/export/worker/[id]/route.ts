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
import { getWorker } from "@/modules/workers/queries"
import { attachRequirementRoles, listRequirementMaps } from "@/modules/workforce/requirements"
import { asStaffRoles } from "@/modules/workforce/roles"

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

  const [types, documents, lapsingWindowDays, requirementMaps] = await Promise.all([
    listEnabledTypes(context),
    listDocumentsForWorker(context, id),
    getLapsingWindowDays(context),
    listRequirementMaps(context),
  ])

  const compliance = computeWorkerCompliance({
    workerId: worker.id,
    workerRoles: asStaffRoles(worker.staff_roles),
    types: attachRequirementRoles(types, requirementMaps),
    documents,
    lapsingWindowDays,
  })

  const format = new URL(request.url).searchParams.get("format")
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
  }
  const surname = worker.last_name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  const stem = `kinsa-compliance-evidence-${surname || "worker"}`

  if (format === "pdf") {
    const buffer = await workerPdf(payload)
    await recordAudit("report.exported", "worker", worker.id, {
      scope: "worker",
      format: "pdf",
    })
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${stem}.pdf"`,
      },
    })
  }

  const csv = workerCsv(payload)
  await recordAudit("report.exported", "worker", worker.id, {
    scope: "worker",
    format: "csv",
  })
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stem}.csv"`,
    },
  })
}
