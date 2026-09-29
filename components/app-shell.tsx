import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppFooterNav, AppNav, WorkspaceHeader } from "@/components/app-nav"
import { can, type TenantContext } from "@/lib/tenant"
import { signOutAction } from "@/modules/identity/actions"

export function AppShell({
  context,
  children,
}: {
  context: TenantContext
  children: React.ReactNode
}) {
  const admin = can(context, "workers.read_all")
  const initials = (context.fullName ?? context.email)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarProvider>
      <Sidebar>
        <WorkspaceHeader name={context.organisationName} logoUrl={context.organisationLogoUrl} admin={admin} />
        <SidebarContent>
          <AppNav admin={admin} />
        </SidebarContent>
        <SidebarFooter className="gap-1">
          <AppFooterNav admin={admin} />
          <div className="flex items-center gap-2 px-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">{initials || "U"}</AvatarFallback>
            </Avatar>
            <p className="min-w-0 flex-1 truncate text-xs">{context.fullName ?? context.email}</p>
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                Sign out
              </Button>
            </form>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-12 items-center px-2 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="w-full min-w-0 flex-1 overflow-x-hidden p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
