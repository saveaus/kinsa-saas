import { CertificateScreen } from "@/components/certificate-screen"

export default async function AdminCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <CertificateScreen
      enrolmentId={id}
      backHref="/courses"
      backLabel="Back to courses"
    />
  )
}
