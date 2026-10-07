import { NextResponse } from "next/server"

import { createServerSupabase } from "@/lib/supabase/server"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { recordAudit } from "@/modules/audit/write"
import { getParticipantFile } from "@/modules/participants/queries"
import type { ParticipantRecordKind } from "@/modules/participants/standing"

function viewedAction(kind: ParticipantRecordKind) {
  switch (kind) {
    case "service_agreement":
      return "service_agreement.viewed"
    case "support_plan":
      return "support_plan.viewed"
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const file = await getParticipantFile(context, id)
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const supabase = await createServerSupabase()
  const { data, error } = await supabase.storage
    .from("participants")
    .download(file.storage_path)

  if (error || !data) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  await recordAudit(viewedAction(file.kind), "participant_record", file.id, {
    filename: file.original_filename,
  })

  const filename = file.original_filename.replace(/["\r\n]/g, "")
  return new NextResponse(new Uint8Array(await data.arrayBuffer()), {
    headers: {
      "Content-Type": file.mime_type,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
