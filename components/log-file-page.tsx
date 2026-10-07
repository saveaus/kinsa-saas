import { notFound } from "next/navigation"

import { BackLink } from "@/components/back-link"
import { PolicyPdf } from "@/components/policy-pdf"
import { formatDate } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { requireRegistered } from "@/modules/billing/guard"
import { getLogEntry, getLogRegister } from "@/modules/logs/queries"

export async function LogFilePage({ slug, id }: { slug: string; id: string }) {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  await requireRegistered(context)
  const entry = await getLogEntry(context, id)
  if (!entry) notFound()
  const register = await getLogRegister(context, entry.register_id)
  if (
    !register ||
    !register.visible ||
    register.slug !== slug ||
    register.built_in
  ) {
    notFound()
  }

  const image = entry.mime_type.startsWith("image/")
  const fileUrl = `/api/logs/${entry.id}`
  const person = entry.participant_name ?? entry.worker_name

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <BackLink href="/reports" />
        <h1 className="font-heading text-lg">{entry.summary}</h1>
        <p className="text-sm text-muted-foreground">
          {entry.original_filename} · {formatDate(entry.occurred_on)}
          {person ? ` · ${person}` : ""}
        </p>
      </div>
      {image ? (
        // The file is the form or screenshot the user asked to view.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={entry.summary}
          className="max-h-[calc(100svh-12rem)] w-full rounded-lg border object-contain"
        />
      ) : (
        <PolicyPdf url={fileUrl} />
      )}
    </div>
  )
}
