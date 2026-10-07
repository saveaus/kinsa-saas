import { readFile } from "node:fs/promises"

import { NextResponse } from "next/server"

import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { policyDocxType } from "@/modules/policies/attachments"
import { templateDocxPath } from "@/modules/policies/template-file"
import { templatesForOrganisation } from "@/modules/policies/templates"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const located = templateDocxPath(key)
  if (!located) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }
  const { template } = located

  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const allowed = templatesForOrganisation(
    context.organisationRegistrationGroups
  )
  if (!allowed.some((choice) => choice.key === template.key)) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 })
  }

  let bytes: Buffer
  try {
    bytes = await readFile(located.filePath)
  } catch {
    return NextResponse.json(
      { error: "Template file not found" },
      { status: 404 }
    )
  }

  const download = new URL(request.url).searchParams.get("download") === "1"
  const filename = `${template.name.replace(/["\r\n\\]/g, "").slice(0, 140)}.docx`
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": policyDocxType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
