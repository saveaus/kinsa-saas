import { NextResponse } from "next/server"

import { createAdminSupabase, hasAdminClient } from "@/lib/supabase/admin"
import { createServerSupabase } from "@/lib/supabase/server"
import { requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { requireRegistered } from "@/modules/billing/guard"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { context } = await requireTenant()
  await requireRegistered(context)
  if (!hasAdminClient()) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
  }

  const supabase = await createServerSupabase()
  const { data: task } = await supabase
    .from("staff_tasks")
    .select("id, policy_id")
    .eq("id", id)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  if (!task?.policy_id) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
  }

  const admin = createAdminSupabase()
  const { data: policy } = await admin
    .from("policies")
    .select("id, storage_path, mime_type, original_filename")
    .eq("id", task.policy_id)
    .eq("organisation_id", context.organisationId)
    .maybeSingle()
  // This reads with the service role, so the path has to be this organisation's.
  if (
    !policy?.storage_path?.startsWith(`${context.organisationId}/`) ||
    !policy.mime_type ||
    !policy.original_filename
  ) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
  }

  const downloaded = await admin.storage
    .from("policies")
    .download(policy.storage_path)
  if (downloaded.error || !downloaded.data) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 })
  }

  await recordAudit("policy.viewed", "policy", policy.id, {
    filename: policy.original_filename,
  })

  const filename = policy.original_filename.replace(/["\r\n]/g, "")
  return new NextResponse(new Uint8Array(await downloaded.data.arrayBuffer()), {
    headers: {
      "Content-Type": policy.mime_type,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
