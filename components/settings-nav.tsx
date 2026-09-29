"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "cn"
import { settingsGroups, settingsSections } from "@/lib/settings-sections"

export function SettingsNav() {
  const pathname = usePathname()

  return (
    <nav className="grid content-start gap-4">
      {settingsGroups.map((group) => (
        <div key={group} className="grid gap-1">
          <p className="px-2 text-xs text-muted-foreground">{group}</p>
          {settingsSections
            .filter((section) => section.group === group)
            .map((section) => {
              const active = pathname === section.href || pathname.startsWith(`${section.href}/`)
              return (
                <Link
                  key={section.href}
                  href={section.href}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                    active && "bg-muted font-medium"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {section.label}
                </Link>
              )
            })}
        </div>
      ))}
    </nav>
  )
}
