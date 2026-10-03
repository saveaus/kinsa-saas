import { IncidentFilePage } from "@/components/incident-file-page"

export default async function IncidentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <IncidentFilePage id={id} kind="incident" />
}
