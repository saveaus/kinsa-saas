import { notFound } from "next/navigation"

import { BackLink } from "@/components/back-link"
import { PolicyPdf } from "@/components/policy-pdf"
import { registeredWall } from "@/components/registered-wall"
import { formatDate } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import {
  getParticipant,
  getParticipantFile,
} from "@/modules/participants/queries"
import type { ParticipantRecordKind } from "@/modules/participants/standing"

function fileDetail(
  kind: ParticipantRecordKind,
  startsOn: string | null,
  endsOn: string | null,
  reviewOn: string | null
) {
  switch (kind) {
    case "service_agreement":
      return `Service agreement · ${formatDate(startsOn)} – ${formatDate(endsOn)}`
    case "support_plan":
      return `Support plan · Review ${formatDate(reviewOn)}`
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export default async function ParticipantFilePage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>
}) {
  const { id, recordId } = await params
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const wall = await registeredWall(context)
  if (wall) return wall
  const [participant, file] = await Promise.all([
    getParticipant(context, id),
    getParticipantFile(context, recordId),
  ])
  if (!participant || !file || file.participant_id !== id) notFound()

  const image = file.mime_type.startsWith("image/")
  const fileUrl = `/api/participants/files/${file.id}`

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <BackLink href={`/participants/${participant.id}`} />
        <h1 className="font-heading text-lg">{file.original_filename}</h1>
        <p className="text-sm text-muted-foreground">
          {fileDetail(file.kind, file.starts_on, file.ends_on, file.review_on)}
        </p>
      </div>
      {image ? (
        // The file is the document the user asked to open.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={file.original_filename}
          className="max-h-[calc(100svh-12rem)] w-full rounded-lg border object-contain"
        />
      ) : (
        <PolicyPdf url={fileUrl} />
      )}
    </div>
  )
}
