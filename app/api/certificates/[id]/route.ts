import { NextResponse } from "next/server"

import { requireTenant } from "@/lib/tenant"
import { recordAudit } from "@/modules/audit/write"
import { loadCourseCertificate } from "@/modules/training/certificate"
import { courseCertificatePdf } from "@/modules/training/certificate-pdf"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { context } = await requireTenant()
  const certificate = await loadCourseCertificate(context, id)
  if (!certificate) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 })
  }

  await recordAudit("certificate.downloaded", "enrolment", certificate.enrolmentId, {
    courseTitle: certificate.courseTitle,
  })

  const buffer = await courseCertificatePdf(certificate)
  const safeName = certificate.courseTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="kinsa-training-certificate-${safeName || "course"}.pdf"`,
    },
  })
}
