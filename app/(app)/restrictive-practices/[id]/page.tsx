import { IncidentFilePage } from "@/components/incident-file-page"

export default async function RestrictivePracticePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <IncidentFilePage id={id} kind="restrictive_practice" />
}
