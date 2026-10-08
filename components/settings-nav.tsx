"use client"

import {
  BadgeCheck,
  Building2,
  ChevronRight,
  CreditCard,
  KeyRound,
  Mail,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

import { cn } from "cn"
import {
  settingsGroups,
  settingsSections,
  type SettingsGroup,
} from "@/lib/settings-sections"

const storageKey = "kinsa-settings-groups"

const sectionIcons: Record<string, LucideIcon> = {
  "/settings/password": KeyRound,
  "/settings/general": Building2,
  "/settings/teams": Users,
  "/settings/permissions": Shield,
  "/settings/credentials": BadgeCheck,
  "/settings/billing": CreditCard,
  "/settings/emails": Mail,
}

function readGroupOpen(group: string) {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === "object" && group in parsed) {
      return Boolean((parsed as Record<string, unknown>)[group])
    }
  } catch {
    return true
  }
  return true
}

function writeGroupOpen(group: string, open: boolean) {
  try {
    const raw = localStorage.getItem(storageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    const stored =
      parsed && typeof parsed === "object"
        ? { ...(parsed as Record<string, boolean>) }
        : {}
    stored[group] = open
    localStorage.setItem(storageKey, JSON.stringify(stored))
  } catch {
    return
  }
}

function SettingsGroupNav({
  group,
  pathname,
  admin,
}: {
  group: SettingsGroup
  pathname: string
  admin: boolean
}) {
  const sections = settingsSections.filter(
    (section) =>
      section.group === group && (section.audience === "everyone" || admin)
  )
  const containsActive = sections.some(
    (section) =>
      pathname === section.href || pathname.startsWith(`${section.href}/`)
  )
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(containsActive || readGroupOpen(group))
  }, [group, containsActive])

  function onToggle() {
    const next = !open
    setOpen(next)
    writeGroupOpen(group, next)
  }

  return (
    <div className="grid gap-0.5">
      <button
        type="button"
        className="flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={open}
        onClick={onToggle}
      >
        <ChevronRight
          className={cn(
            "size-3 shrink-0 transition-transform",
            open && "rotate-90"
          )}
        />
        <span>{group}</span>
      </button>
      {open ? (
        <div className="grid gap-0.5">
          {sections.map((section) => {
            const active =
              pathname === section.href ||
              pathname.startsWith(`${section.href}/`)
            const Icon = sectionIcons[section.href]
            return (
              <Link
                key={section.href}
                href={section.href}
                className={cn(
                  "flex items-center gap-2 rounded-md py-1.5 pr-2 pl-6 text-sm text-foreground/80 hover:bg-muted",
                  active && "bg-muted font-medium text-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                {Icon ? (
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                ) : null}
                <span>{section.label}</span>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export function SettingsNav({ admin }: { admin: boolean }) {
  const pathname = usePathname()
  const groups = settingsGroups.filter((group) =>
    settingsSections.some(
      (section) =>
        section.group === group && (section.audience === "everyone" || admin)
    )
  )

  return (
    <nav
      aria-label="Settings"
      className="grid content-start gap-3 md:sticky md:top-0 md:self-start"
    >
      <p className="px-2 text-sm font-medium">Settings</p>
      {groups.map((group) => (
        <SettingsGroupNav
          key={group}
          group={group}
          pathname={pathname}
          admin={admin}
        />
      ))}
    </nav>
  )
}
