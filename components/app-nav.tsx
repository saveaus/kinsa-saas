"use client"

import {
  Activity,
  BadgeCheck,
  BookOpen,
  ChevronDown,
  FileDown,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Settings,
  Shield,
  SunMoon,
  Users,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"

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
import { OrgMark } from "@/components/org-mark"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { signOutAction } from "@/modules/identity/actions"

type NavItem = { href: string; label: string; icon: LucideIcon }

const adminPrimary: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workers", label: "Workers", icon: Users },
  { href: "/approvals", label: "Approvals", icon: BadgeCheck },
  { href: "/courses", label: "Courses", icon: BookOpen },
  { href: "/me/courses", label: "My courses", icon: GraduationCap },
]

const adminReports: NavItem[] = [
  { href: "/reports", label: "Evidence", icon: FileDown },
  { href: "/activity", label: "Activity", icon: Activity },
]

const workerItems: NavItem[] = [
  { href: "/me", label: "Compliance", icon: Shield },
  { href: "/me/documents", label: "Documents", icon: BadgeCheck },
  { href: "/me/courses", label: "My courses", icon: GraduationCap },
]

function isActive(pathname: string, href: string) {
  if (href === "/me") return pathname === "/me"
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton isActive={isActive(pathname, item.href)} render={<Link href={item.href} />}>
            <item.icon />
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
          <DropdownMenuItem onClick={() => router.push("/account")}>
            <KeyRound />
            Password
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunMoon />
              Theme
              {mounted ? <span className="ml-auto text-xs text-muted-foreground">{themeLabel(selected)}</span> : null}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={selected}
                onValueChange={(value) => setTheme(asTheme(typeof value === "string" ? value : undefined))}
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
          <DropdownMenuItem onClick={() => signOutAction()}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SidebarTrigger className="ml-auto text-muted-foreground" />
    </SidebarHeader>
  )
}

export function AppNav({ admin }: { admin: boolean }) {
  const pathname = usePathname()

  if (!admin) {
    return (
      <SidebarGroup className="py-1">
        <SidebarGroupContent>
          <NavMenu items={workerItems} pathname={pathname} />
        </SidebarGroupContent>
      </SidebarGroup>
    )
  }

  return (
    <>
      <SidebarGroup className="py-1">
        <SidebarGroupContent>
          <NavMenu items={adminPrimary} pathname={pathname} />
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="py-1">
        <SidebarGroupLabel className="h-6 text-[11px] font-normal text-muted-foreground">Reports</SidebarGroupLabel>
        <SidebarGroupContent>
          <NavMenu items={adminReports} pathname={pathname} />
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  )
}

export function AppFooterNav({ admin }: { admin: boolean }) {
  const pathname = usePathname()
  if (!admin) return null

  const items: NavItem[] = [{ href: "/settings/general", label: "Settings", icon: Settings }]

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                isActive={item.href.startsWith("/settings") ? pathname.startsWith("/settings") : isActive(pathname, item.href)}
                render={<Link href={item.href} />}
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
