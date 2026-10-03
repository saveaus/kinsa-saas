import { NextResponse } from "next/server"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { getPolicy } from "@/modules/policies/queries"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const policy = await getPolicy(context, id)
  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.storage
    .from("policies")
    .download(policy.storage_path)

  if (error || !data) {
    return NextResponse.json({ error: "Policy file not found" }, { status: 404 })
  }

  await recordAudit("policy.viewed", "policy", policy.id, {
    filename: policy.original_filename,
  })

  const filename = policy.original_filename.replace(/["\r\n]/g, "")
  return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
    headers: {
      "Content-Type": policy.mime_type,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
