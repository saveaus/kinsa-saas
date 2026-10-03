import { SupportPlanCheckFilePage } from "@/components/support-plan-check-file-page"

export default async function SupportPlanCheckPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <SupportPlanCheckFilePage id={id} />
}
