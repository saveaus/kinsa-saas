import type { ReactNode } from "react"

import { cn } from "cn"

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-16", className)}>
      {compact ? null : <EmptyMark icon={icon} />}
      <p className={cn("text-sm font-medium", compact ? undefined : "mt-4")}>{title}</p>
      {description ? <p className="mt-1 max-w-xs text-sm text-balance text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

function EmptyMark({ icon }: { icon?: ReactNode }) {
  return (
    <div className="relative h-16 w-28" aria-hidden>
      <svg viewBox="0 0 112 64" className="absolute inset-0 size-full text-primary/30">
        <circle cx="40" cy="32" r="18" fill="none" stroke="currentColor" strokeDasharray="3 4" />
        <path
          d="M78 22 L92 30 L78 38 L64 30 Z"
          fill="none"
          stroke="currentColor"
          strokeLinejoin="round"
        />
        <path d="M64 30 L64 44 L78 52 L78 38" fill="none" stroke="currentColor" strokeLinejoin="round" />
        <path d="M78 38 L92 30 L92 44 L78 52" fill="none" stroke="currentColor" strokeLinejoin="round" />
      </svg>
      <span className="absolute top-3 left-5 flex size-10 items-center justify-center rounded-full border border-primary/30 bg-background text-primary">
        {icon ?? <span className="size-2 rounded-full bg-current" />}
      </span>
    </div>
  )
}
