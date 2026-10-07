"use client"

import Link from "next/link"
import { useState } from "react"

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

export function SupportPlanCheckFileButton({
  checkId,
  note,
  filename,
  mimeType,
}: {
  checkId: string
  note: string
  filename: string
  mimeType: string
}) {
  const fileUrl = `/api/support-plan-checks/${checkId}`
  const image = mimeType.startsWith("image/")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        View
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{note}</DialogTitle>
          <DialogDescription>{filename}</DialogDescription>
        </DialogHeader>
        <Link
          href={`/support-plan-checks/${checkId}`}
          className="group grid cursor-pointer gap-2"
        >
          <span className="relative block max-h-96 overflow-hidden rounded-lg border bg-white group-hover:ring-2 group-hover:ring-foreground/15">
            {open && image ? (
              // The preview is the uploaded note or screenshot.
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
