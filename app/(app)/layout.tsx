import { AppShell } from "@/components/app-shell"
import { requireTenant } from "@/lib/tenant"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { context } = await requireTenant()
  return <AppShell context={context}>{children}</AppShell>
}
