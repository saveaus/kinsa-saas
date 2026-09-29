import { CertificateScreen } from "@/components/certificate-screen"

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <CertificateScreen
      enrolmentId={id}
      backHref={`/me/courses/${id}`}
      backLabel="Back to course"
    />
  )
}
