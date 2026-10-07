"use client"

import {
  Activity,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileDown,
  FileText,
  KeyRound,
  LayoutDashboard,
  Settings,
  Shield,
  SunMoon,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { usePathname, useRouter } from "next/navigation"
import { Fragment, useEffect, useState } from "react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AssistantNav } from "@/components/assistant-nav"
import { OrgMark } from "@/components/org-mark"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { cn } from "cn"
import { signOutAction } from "@/modules/identity/actions"
import type { AssistantChatLink } from "@/modules/assistant/chats"

type NavItem = {
  href: string
  label: string
  icon?: LucideIcon
}

function adminGroups(): { label?: string; items: NavItem[] }[] {
  return [
    {
      items: [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Records",
      items: [
        { href: "/workers", label: "Workers", icon: Users },
        { href: "/participants", label: "Participants", icon: UserRound },
        { href: "/approvals", label: "Approvals", icon: BadgeCheck },
        { href: "/policies", label: "Policies", icon: FileText },
      ],
    },
    {
      label: "Reports",
      items: [
        { href: "/audits", label: "Audits", icon: ClipboardCheck },
        { href: "/reports", label: "Evidence", icon: FileDown },
        { href: "/activity", label: "Activity", icon: Activity },
      ],
    },
  ]
}

const workerItems: NavItem[] = [
  { href: "/me", label: "Compliance", icon: Shield },
  { href: "/audits", label: "Audits", icon: ClipboardCheck },
  { href: "/me/documents", label: "Documents", icon: BadgeCheck },
]

function isActive(pathname: string, href: string) {
  if (href === "/me") return pathname === "/me"
  return pathname === href || pathname.startsWith(`${href}/`)
}

const navGroupStorageKey = "kinsa-nav-groups"

function readGroupOpen(label: string) {
  try {
    const raw = localStorage.getItem(navGroupStorageKey)
    if (!raw) return true
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return true
    const stored = (parsed as Record<string, unknown>)[label]
    return typeof stored === "boolean" ? stored : true
  } catch {
    return true
  }
}

function writeGroupOpen(label: string, open: boolean) {
  try {
    const raw = localStorage.getItem(navGroupStorageKey)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    const stored =
      parsed && typeof parsed === "object"
        ? { ...(parsed as Record<string, boolean>) }
        : {}
    stored[label] = open
    localStorage.setItem(navGroupStorageKey, JSON.stringify(stored))
  } catch {
    return
  }
}

function NavGroup({
  label,
  items,
  pathname,
  extra,
  empty,
}: {
  label: string
  items: NavItem[]
  pathname: string
  extra?: React.ReactNode
  empty?: React.ReactNode
}) {
  const { state } = useSidebar()
  const containsActive = items.some((item) => isActive(pathname, item.href))
  const [open, setOpen] = useState(true)
  const shown = open || state === "collapsed"

  useEffect(() => {
    setOpen(containsActive || readGroupOpen(label))
  }, [label, containsActive])

  function onOpenChange(next: boolean) {
    setOpen(next)
    writeGroupOpen(label, next)
  }

  return (
    <Collapsible open={shown} onOpenChange={onOpenChange}>
      <SidebarGroup className="group/label py-1">
        <div className="flex h-6 items-center pr-1 group-data-[collapsible=icon]:hidden">
          <CollapsibleTrigger className="flex h-6 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 text-left text-[11px] font-normal text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            <span className="flex size-4 shrink-0 items-center justify-center">
              <ChevronRight
                className={cn(
                  "size-3 transition-transform duration-150",
                  open && "rotate-90",
                  open ? "opacity-0 group-hover/label:opacity-100" : "opacity-100"
                )}
              />
            </span>
            <span className="truncate">{label}</span>
          </CollapsibleTrigger>
          {extra}
        </div>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-150 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
          <SidebarGroupContent>
            {items.length > 0 ? <NavMenu items={items} pathname={pathname} /> : empty}
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}

function NavIcon({ icon: Icon }: { icon?: LucideIcon }) {
  if (!Icon) return null
  return <Icon />
}

function NavMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            isActive={isActive(pathname, item.href)}
            render={<Link href={item.href} />}
          >
            <NavIcon icon={item.icon} />
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}

const themeChoices = ["light", "dark", "system"] as const
type ThemeChoice = (typeof themeChoices)[number]

function asTheme(value: string | undefined): ThemeChoice {
  if (value === "light" || value === "dark" || value === "system") return value
  return "system"
}

function themeLabel(theme: ThemeChoice) {
  switch (theme) {
    case "light":
      return "Light"
    case "dark":
      return "Dark"
    case "system":
      return "System"
    default: {
      const unreachable: never = theme
      return unreachable
    }
  }
}

export function CollapsedSidebarTrigger() {
  const { isMobile, state } = useSidebar()
  if (isMobile || state !== "collapsed") return null
  return (
    <div className="flex h-12 shrink-0 items-center px-2">
      <SidebarTrigger />
    </div>
  )
}

export function WorkspaceHeader({
  name,
  logoUrl,
  admin,
}: {
  name: string
  logoUrl: string | null
  admin: boolean
}) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const selected = asTheme(theme)

  return (
    <SidebarHeader className="flex-row items-center gap-0.5 px-1.5 py-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-sm font-medium outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-popup-open:bg-sidebar-accent">
          <OrgMark name={name} logoUrl={logoUrl} />
          <span className="truncate">{name}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {admin ? (
            <DropdownMenuItem onClick={() => router.push("/settings/general")}>
              <Settings />
              Settings
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={() => router.push("/settings/password")}>
            <KeyRound />
            Password
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunMoon />
              Theme
              {mounted ? (
                <span className="ml-auto text-xs text-muted-foreground">
                  {themeLabel(selected)}
                </span>
              ) : null}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={selected}
                onValueChange={(value) =>
                  setTheme(
                    asTheme(typeof value === "string" ? value : undefined)
                  )
                }
              >
                {themeChoices.map((choice) => (
                  <DropdownMenuRadioItem key={choice} value={choice}>
                    {themeLabel(choice)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOutAction()}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SidebarTrigger className="ml-auto text-muted-foreground" />
    </SidebarHeader>
  )
}

export function AppNav({
  admin,
  chats,
}: {
  admin: boolean
  chats: AssistantChatLink[]
}) {
  const pathname = usePathname()

  if (!admin) {
    const [home, ...rest] = workerItems
    return (
      <SidebarGroup className="py-1">
        <SidebarGroupContent>
          <SidebarMenu>
            {home ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive(pathname, home.href)}
                  render={<Link href={home.href} />}
                >
                  <NavIcon icon={home.icon} />
                  <span>{home.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : null}
            <AssistantNav chats={chats} pathname={pathname} />
            {rest.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  isActive={isActive(pathname, item.href)}
                  render={<Link href={item.href} />}
                >
                  <NavIcon icon={item.icon} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <>
      {adminGroups().map((group) => (
        <Fragment key={group.label ?? "home"}>
          {group.label ? (
            <NavGroup
              label={group.label}
              items={group.items}
              pathname={pathname}
            />
          ) : (
            <SidebarGroup className="py-1">
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={isActive(pathname, item.href)}
                        render={<Link href={item.href} />}
                      >
                        <NavIcon icon={item.icon} />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  <AssistantNav chats={chats} pathname={pathname} />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </Fragment>
      ))}
    </>
  )
}

export function AppFooterNav({ admin }: { admin: boolean }) {
  const pathname = usePathname()
  if (!admin) return null

  const items: NavItem[] = [
    { href: "/settings/general", label: "Settings", icon: Settings },
  ]

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={
                  item.href.startsWith("/settings")
                    ? pathname.startsWith("/settings")
                    : isActive(pathname, item.href)
                }
                render={<Link href={item.href} />}
              >
                <NavIcon icon={item.icon} />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
