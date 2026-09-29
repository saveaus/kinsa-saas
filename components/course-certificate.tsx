import { format, parseISO } from "date-fns"

import { OrgMark } from "@/components/org-mark"
import type { CourseCertificate } from "@/modules/training/certificate"

export function CourseCertificateView({ certificate }: { certificate: CourseCertificate }) {
  return (
    <article className="grid gap-6 rounded-xl border p-8 md:p-10">
      <header className="flex items-center gap-4">
        <OrgMark
          name={certificate.organisationName}
          logoUrl={certificate.logoUrl}
          className="size-16 rounded-md text-base"
        />
        <div>
          <p className="font-heading text-lg">{certificate.organisationName}</p>
          <p className="text-sm text-muted-foreground">
            ABN {certificate.abnLabel} · {certificate.registrationLabel}
          </p>
        </div>
      </header>
      <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
        Certificate of completion
      </p>
      <h1 className="font-heading text-3xl">Training certificate</h1>
      <div className="grid gap-2 text-base leading-7">
        <p>This certifies that</p>
        <p className="font-heading text-2xl">{certificate.workerName}</p>
        <p>has completed</p>
        <p className="text-lg font-medium">{certificate.courseTitle}</p>
        <p>
          on {format(parseISO(certificate.completedOn), "d MMMM yyyy")}
          {certificate.score != null ? ` with a score of ${certificate.score}%` : ""}.
          {certificate.validUntil ? ` Valid until ${certificate.validUntil}.` : ""}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Issued by {certificate.organisationName} in Kinsa. This records an in-app training pass. It does not replace a
        registered training organisation certificate, NDIS Worker Screening, the NDIS Worker Orientation Module, a
        Working with Children Check, first aid, CPR, or a practical competency sign-off.
      </p>
    </article>
  )
}
