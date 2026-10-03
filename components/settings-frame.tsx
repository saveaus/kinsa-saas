import type { ReactNode } from "react"

import { cn } from "cn"
import { settingsSections } from "@/lib/settings-sections"

export function SettingsFrame({
  href,
  note,
  wide = false,
  children,
}: {
  href: string
  note?: string
  wide?: boolean
  children: ReactNode
}) {
  const section = settingsSections.find((item) => item.href === href)

  return (
    <div className={cn("grid gap-8", wide ? "max-w-5xl" : "max-w-2xl")}>
      {section ? (
        <header className="grid gap-1.5">
          <p className="text-sm text-muted-foreground">
            {section.group} settings
            <span
              className="px-1.5 text-muted-foreground/50"
              aria-hidden="true"
            >
              /
            </span>
            {section.label}
          </p>
          <h1 className="font-heading text-2xl tracking-tight">
            {section.label}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {section.description}
          </p>
          {note ? (
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {note}
            </p>
          ) : null}
        </header>
      ) : null}
      {children}
    </div>
  )
}

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="grid gap-4 border-t pt-6">
      <div className="grid gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="max-w-xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  )
}
