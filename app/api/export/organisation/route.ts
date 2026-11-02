import { NextResponse } from "next/server"

import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { recordAudit } from "@/modules/audit/write"
import { loadAuditPack } from "@/modules/audit-pack/load"
import {
  buildWorkforceCompliance,
  getLapsingWindowDays,
} from "@/modules/documents/queries"
import { loadOrganisationEvidence } from "@/modules/reports/dossier"
import { organisationCsv } from "@/modules/reports/export"
import { organisationPdf } from "@/modules/reports/pdf"

export async function GET(request: Request) {
  const { context } = await requireTenant()
  requirePermission(context, "reports.export")
  await requireRegistered(context)
  const [rows, lapsingWindowDays] = await Promise.all([
    buildWorkforceCompliance(context),
    getLapsingWindowDays(context),
  ])
  const pack = await loadAuditPack(context, rows, lapsingWindowDays)
  const evidence = await loadOrganisationEvidence(context, rows, pack.items, pack.scope)
  const format = new URL(request.url).searchParams.get("format")
  await recordAudit("report.exported", "organisation", context.organisationId, {
    scope: "organisation",
    format: format === "pdf" ? "pdf" : "csv",
  })

  const stem = `kinsa-compliance-evidence-${context.organisationId.slice(0, 8)}`
  if (format === "pdf") {
    const buffer = await organisationPdf(evidence)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${stem}.pdf"`,
      },
    })
  }

  return new NextResponse(organisationCsv(evidence), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${stem}.csv"`,
    },
  })
}
