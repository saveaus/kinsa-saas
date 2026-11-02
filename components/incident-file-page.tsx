import { notFound } from "next/navigation"

import { BackLink } from "@/components/back-link"
import { PolicyPdf } from "@/components/policy-pdf"
import { registeredWall } from "@/components/registered-wall"
import { formatDate } from "@/lib/format-date"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { getIncident } from "@/modules/incidents/queries"
import { listLogRegisters } from "@/modules/logs/queries"
import { logShown } from "@/modules/logs/standing"
import {
  incidentListPath,
  type IncidentKind,
} from "@/modules/incidents/standing"

export async function IncidentFilePage({
  id,
  kind,
}: {
  id: string
  kind: IncidentKind
}) {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  const wall = await registeredWall(context)
  if (wall) return wall
  const incident = await getIncident(context, id)
  if (!incident || incident.kind !== kind) notFound()
  const logs = await listLogRegisters(context)
  if (!logShown(logs, kind)) notFound()

  const image = incident.mime_type.startsWith("image/")
  const fileUrl = `/api/incidents/${incident.id}`

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <BackLink href={incidentListPath(incident.kind)} />
        <h1 className="font-heading text-lg">{incident.summary}</h1>
        <p className="text-sm text-muted-foreground">
          {incident.original_filename} · {formatDate(incident.occurred_on)}
          {incident.participant_name ? ` · ${incident.participant_name}` : ""}
        </p>
      </div>
      {image ? (
        // The file is the form or screenshot the user asked to view.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={incident.summary}
          className="max-h-[calc(100svh-12rem)] w-full rounded-lg border object-contain"
        />
      ) : (
        <PolicyPdf url={fileUrl} />
      )}
    </div>
  )
}
