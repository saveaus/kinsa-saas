import { Flag } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "cn"

export function PolicyFlagLink({
  id,
  labeled = false,
}: {
  id: string
  labeled?: boolean
}) {
  return (
    <a
      href={`/assistant?policy=${id}`}
      aria-label="Why this policy is not compliant"
      className={cn(
        buttonVariants({ variant: "outline", size: labeled ? "sm" : "icon-sm" })
      )}
    >
      <Flag />
      {labeled ? "Flag" : null}
    </a>
  )
}
