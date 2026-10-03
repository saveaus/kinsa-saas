import { IncidentFilePage } from "@/components/incident-file-page"

export default async function ComplaintPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <IncidentFilePage id={id} kind="complaint" />
}
