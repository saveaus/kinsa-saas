import { BillingNoticeBar } from "@/components/billing-notice-bar"
import { Toaster } from "@/components/ui/toast"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  AppFooterNav,
  AppNav,
  CollapsedSidebarTrigger,
  WorkspaceHeader,
} from "@/components/app-nav"
import { formatPersonLabel } from "@/lib/person-name"
import { can, type TenantContext } from "@/lib/tenant"
import type { BillingNotice } from "@/modules/billing/access"
import { listAssistantChats } from "@/modules/assistant/chats"
import { signOutAction } from "@/modules/identity/actions"
export async function AppShell({
  context,
  children,
  billingNotice,
}: {
  context: TenantContext
  children: React.ReactNode
  billingNotice?: BillingNotice | null
}) {
  const admin = can(context, "workers.read_all")
  const chats = await listAssistantChats(context)
  const personLabel = context.fullName
    ? formatPersonLabel(context.fullName)
    : context.email
  const initials = personLabel
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <SidebarProvider>
      <Toaster />
      <Sidebar>
        <WorkspaceHeader
          name={context.organisationName}
          logoUrl={context.organisationLogoUrl}
          admin={admin}
        />
        <SidebarContent>
          <AppNav admin={admin} chats={chats} />
        </SidebarContent>
        <SidebarFooter className="gap-1">
          <AppFooterNav admin={admin} />
          <div className="flex items-center gap-2 px-2">
            <Avatar className="size-6">
              <AvatarFallback className="text-[10px]">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
            <p className="min-w-0 flex-1 truncate text-xs">{personLabel}</p>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground"
              >
                Sign out
              </Button>
            </form>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="h-svh max-h-svh min-w-0 overflow-hidden">
        <CollapsedSidebarTrigger />
        <header className="flex h-12 shrink-0 items-center px-2 md:hidden">
          <SidebarTrigger />
        </header>
        {billingNotice ? <BillingNoticeBar notice={billingNotice} /> : null}
        <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto p-4 has-[[data-assistant]]:overflow-hidden has-[[data-assistant]]:p-0 has-[[data-worker-record]]:overflow-hidden has-[[data-worker-record]]:p-0 md:p-6 md:has-[[data-assistant]]:p-0 md:has-[[data-worker-record]]:p-0">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
