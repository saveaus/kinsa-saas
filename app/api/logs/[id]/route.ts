import { NextResponse } from "next/server"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { getLogEntry, getLogRegister } from "@/modules/logs/queries"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const entry = await getLogEntry(context, id)
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  }
  const register = await getLogRegister(context, entry.register_id)
  if (!register || !register.visible || register.built_in) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.storage
    .from("logs")
    .download(entry.storage_path)

  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  await recordAudit("log.viewed", "log_entry", entry.id, {
    filename: entry.original_filename,
    name: register.name,
  })

  const filename = entry.original_filename.replace(/["\r\n]/g, "")
  return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
    headers: {
      "Content-Type": entry.mime_type,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
