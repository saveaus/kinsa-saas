import { NextResponse } from "next/server"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { recordAudit } from "@/modules/audit/write"
import { getSupportPlanCheck } from "@/modules/support-plan-checks/queries"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const check = await getSupportPlanCheck(context, id)
  if (!check?.storage_path || !check.mime_type || !check.original_filename) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.storage
    .from("support-plan-checks")
    .download(check.storage_path)

  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  await recordAudit(
    "support_plan_check.viewed",
    "support_plan_check",
    check.id,
    { filename: check.original_filename }
  )

  const filename = check.original_filename.replace(/["\r\n]/g, "")
  return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
    headers: {
      "Content-Type": check.mime_type,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
