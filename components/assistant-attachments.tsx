"use client"

import { FileText, X } from "lucide-react"

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment"
import { attachmentLabel } from "@/modules/assistant/attachments"

export type AssistantAttachmentChip = {
  id: string
  name: string
  mediaType: string
  size?: number
  previewUrl?: string | null
}

export function AssistantImagePreviews({ items }: { items: AssistantAttachmentChip[] }) {
  const images = items.filter((item) => item.previewUrl && item.mediaType.startsWith("image/"))
  if (images.length === 0) return null
  return (
    <div className="grid justify-items-end gap-2">
      {images.map((item) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={item.id}
          src={item.previewUrl ?? ""}
          alt={item.name}
          className="max-h-64 max-w-full rounded-2xl border object-contain"
        />
      ))}
    </div>
  )
}

export function AssistantAttachmentChips({
  items,
  onRemove,
}: {
  items: AssistantAttachmentChip[]
  onRemove?: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <AttachmentGroup>
      {items.map((item) => {
        const image = item.previewUrl && item.mediaType.startsWith("image/")
        return (
          <Attachment key={item.id} size="sm" orientation={image ? "vertical" : "horizontal"}>
            <AttachmentMedia variant={image ? "image" : "icon"}>
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.previewUrl ?? ""} alt="" />
              ) : (
                <FileText />
              )}
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{item.name}</AttachmentTitle>
              {typeof item.size === "number" ? (
                <AttachmentDescription>
                  {attachmentLabel({
                    name: item.name,
                    mediaType: item.mediaType,
                    size: item.size,
                  })}
                </AttachmentDescription>
              ) : (
                <AttachmentDescription>{kindLabel(item)}</AttachmentDescription>
              )}
            </AttachmentContent>
            {onRemove ? (
              <AttachmentActions>
                <AttachmentAction
                  aria-label={`Remove ${item.name}`}
                  onClick={() => onRemove(item.id)}
                >
                  <X />
                </AttachmentAction>
              </AttachmentActions>
            ) : null}
          </Attachment>
        )
      })}
    </AttachmentGroup>
  )
}

function kindLabel(item: AssistantAttachmentChip) {
  if (item.mediaType.startsWith("image/")) return "Image"
  if (item.mediaType === "application/pdf") return "PDF"
  if (item.mediaType.startsWith("text/")) return "Text"
  return "File"
}
