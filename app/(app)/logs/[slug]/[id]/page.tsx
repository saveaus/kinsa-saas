import { LogFilePage } from "@/components/log-file-page"

export default async function LogEntryPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  return <LogFilePage slug={slug} id={id} />
}
