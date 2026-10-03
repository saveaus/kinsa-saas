"use client"

import Link from "next/link"
import { useState } from "react"

import { ActionForm } from "@/components/action-form"
import { PolicyPdf } from "@/components/policy-pdf"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  acceptIncidentAction,
  deleteIncidentDraftAction,
} from "@/modules/incidents/actions"
import {
  incidentListPath,
  type IncidentKind,
} from "@/modules/incidents/standing"

export function IncidentFileButton({
  incidentId,
  kind,
  summary,
  filename,
  mimeType,
}: {
  incidentId: string
  kind: IncidentKind
  summary: string
  filename: string
  mimeType: string
}) {
  const fileUrl = `/api/incidents/${incidentId}`
  const image = mimeType.startsWith("image/")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        View
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{summary}</DialogTitle>
          <DialogDescription>{filename}</DialogDescription>
        </DialogHeader>
        <Link
          href={`${incidentListPath(kind)}/${incidentId}`}
          className="group grid cursor-pointer gap-2"
        >
          <span className="relative block max-h-96 overflow-hidden rounded-lg border bg-white group-hover:ring-2 group-hover:ring-foreground/15">
            {open && image ? (
              // The preview is the uploaded form or screenshot.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fileUrl}
                alt=""
                className="w-full object-contain object-top"
              />
            ) : null}
            {open && !image ? (
              <PolicyPdf
                url={fileUrl}
                pageLimit={1}
                canvasClassName="w-full bg-white"
              />
            ) : null}
          </span>
          <span className="text-sm text-foreground">Open file</span>
        </Link>
      </DialogContent>
    </Dialog>
  )
}

export function IncidentDraftActions({ incidentId }: { incidentId: string }) {
  return (
    <div className="flex gap-1">
      <ActionForm
        action={acceptIncidentAction.bind(null, incidentId)}
        submitLabel="Accept"
        pendingLabel="Accepting..."
        submitSize="sm"
        className="w-fit"
      />
      <ActionForm
        action={deleteIncidentDraftAction.bind(null, incidentId)}
        submitLabel="Remove"
        pendingLabel="Removing..."
        submitVariant="outline"
        submitSize="sm"
        className="w-fit"
      />
    </div>
  )
}
