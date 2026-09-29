import { notFound } from "next/navigation"

import { CourseCertificateView } from "@/components/course-certificate"
import { PrintButton } from "@/components/print-button"
import { buttonVariants } from "@/components/ui/button"
import { requireTenant } from "@/lib/tenant"
import { loadCourseCertificate } from "@/modules/training/certificate"

export async function CertificateScreen({
  enrolmentId,
  backHref,
  backLabel,
}: {
  enrolmentId: string
  backHref: string
  backLabel: string
}) {
  const { context } = await requireTenant()
  const certificate = await loadCourseCertificate(context, enrolmentId)
  if (!certificate) notFound()

  return (
    <div className="mx-auto grid min-h-full max-w-3xl content-center gap-6 overflow-y-auto px-6 py-10">
      <CourseCertificateView certificate={certificate} />
      <div className="flex flex-wrap gap-2 print:hidden">
        <a
          href={`/api/certificates/${certificate.enrolmentId}`}
          className={buttonVariants()}
        >
          Download PDF
        </a>
        <PrintButton />
        <a href={backHref} className={buttonVariants({ variant: "ghost" })}>
          {backLabel}
        </a>
      </div>
    </div>
  )
}
