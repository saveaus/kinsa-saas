"use client"

import { Button } from "@/components/ui/button"
import { createDocumentAccessUrl } from "@/modules/documents/actions"

export function DocumentViewButton({ documentId }: { documentId: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        const url = await createDocumentAccessUrl(documentId)
        window.open(url, "_blank", "noopener,noreferrer")
      }}
    >
      View
    </Button>
  )
}
