import type { ReactNode } from "react"

import { WallPlaceholder } from "@/components/wall-placeholder"

// Takes no children on purpose: real data must never sit behind the blur.
export function UpgradeWall({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm" inert aria-hidden>
        <WallPlaceholder />
      </div>
      <div className="absolute inset-0 z-10 flex items-start justify-center pt-24">
        <div className="pointer-events-auto w-full max-w-sm rounded-xl bg-popover p-4 text-sm shadow-lg ring-1 ring-foreground/10">
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-muted-foreground">{description}</p>
          {action ? <div className="mt-4 flex justify-end">{action}</div> : null}
        </div>
      </div>
    </div>
  )
}
