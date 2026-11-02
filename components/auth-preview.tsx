import {
  ArrowUp,
  FileDown,
  FileText,
  LayoutDashboard,
  ListTodo,
  ScrollText,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Chip } from "@/components/chip"
import { OrgMark, organisationInitials } from "@/components/org-mark"

const nav: { label: string; group: string | null; icon: LucideIcon }[] = [
  { label: "Dashboard", group: null, icon: LayoutDashboard },
  { label: "Assistant", group: null, icon: Sparkles },
  { label: "Tasks", group: "Work", icon: ListTodo },
  { label: "Workers", group: "Records", icon: Users },
  { label: "Policies", group: "Records", icon: FileText },
  { label: "Logs", group: "Records", icon: ScrollText },
  { label: "Evidence", group: "Reports", icon: FileDown },
]

const workers = [
  { name: "Alex Chen", role: "Support worker", percent: "25%", tone: "yellow" as const },
  { name: "Sam Patel", role: "Support worker", percent: "100%", tone: "green" as const },
  { name: "Jordan Lee", role: "Leader", percent: "0%", tone: "red" as const },
]

const checks = [
  { item: "NDIS worker screening", status: "Missing", tone: "red" as const },
  { item: "First aid", status: "Met", tone: "green" as const },
  { item: "Person-centred supports", status: "Met", tone: "green" as const },
  { item: "Complaints register", status: "Due today", tone: "yellow" as const },
]

export function AccountPreview({ name }: { name: string }) {
  const label = name.trim() || "You"
  return (
    <ProductFrame workspace="Workspace" active="Workers" account={label}>
      <WorkersPreview person={label} />
    </ProductFrame>
  )
}

export function OrganisationPreview({
  name,
  logoUrl = null,
}: {
  name: string
  logoUrl?: string | null
}) {
  return (
    <ProductFrame
      workspace={name.trim() || "Your organisation"}
      logoUrl={logoUrl}
      active="Dashboard"
    >
      <DashboardPreview />
    </ProductFrame>
  )
}

function ProductFrame({
  workspace,
  logoUrl = null,
  active,
  account,
  children,
}: {
  workspace: string
  logoUrl?: string | null
  active: string
  account?: string
  children: React.ReactNode
}) {
  let shownGroup: string | null = null

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-6 overflow-hidden rounded-xl border bg-background shadow-sm">
        <div className="flex h-full">
          <aside className="flex h-full w-40 shrink-0 flex-col border-r bg-sidebar px-2 py-2">
            <div className="flex items-center gap-2 rounded-md px-1.5 py-1.5">
              <OrgMark name={workspace} logoUrl={logoUrl} />
              <span className="truncate text-[11px] font-medium">{workspace}</span>
            </div>
            <ul className="mt-3 grid gap-0.5">
              {nav.map((item) => {
                const heading = item.group !== shownGroup ? item.group : null
                shownGroup = item.group
                const selected = item.label === active
                return (
                  <li key={item.label}>
                    {heading ? (
                      <p className="px-1.5 pt-2 pb-0.5 text-[9px] text-muted-foreground">{heading}</p>
                    ) : null}
                    <p
                      className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] ${
                        selected ? "bg-sidebar-accent font-medium text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      <item.icon className="size-3 shrink-0" />
                      {item.label}
                    </p>
                  </li>
                )
              })}
            </ul>
            {account ? (
              <div className="mt-auto flex items-center gap-1.5 border-t px-1.5 pt-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[8px] font-medium text-primary">
                  {organisationInitials(account)}
                </span>
                <span className="truncate text-[11px]">{account}</span>
              </div>
            ) : null}
          </aside>
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  )
}

function DashboardPreview() {
  return (
    <div className="grid gap-3 p-3">
      <div className="rounded-xl border bg-background px-2.5 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">Ask a question</p>
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <ArrowUp className="size-3" />
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="rounded-md bg-[#F1F2F4] px-1.5 py-0.5 text-[9px] font-medium text-[#5E6570]">
          What&apos;s due this week
        </span>
        <span className="rounded-md bg-[#F1F2F4] px-1.5 py-0.5 text-[9px] font-medium text-[#5E6570]">
          Draft a policy
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between border-b px-2.5 py-1.5">
          <p className="text-[11px] font-medium">Today&apos;s check</p>
          <span className="rounded-md border px-1.5 py-0.5 text-[9px]">Download pack</span>
        </div>
        <table className="w-full text-left text-[10px]">
          <tbody>
            {checks.map((row) => (
              <tr key={row.item} className="border-b last:border-0">
                <td className="px-2.5 py-1.5">{row.item}</td>
                <td className="px-2 py-1.5 text-right">
                  <Chip tone={row.tone} className="h-4 px-1 text-[9px]">
                    {row.status}
                  </Chip>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function WorkersPreview({ person }: { person: string }) {
  return (
    <div>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-[11px] font-medium">All workers</p>
        <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">Add worker</span>
      </div>
      <table className="w-full text-left text-[10px]">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-1.5 font-normal">Name</th>
            <th className="px-2 py-1.5 font-normal">Teams</th>
            <th className="px-2 py-1.5 font-normal">Percent</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-3 py-1.5 font-medium">{person}</td>
            <td className="px-2 py-1.5 text-muted-foreground">Administrator</td>
            <td className="px-2 py-1.5">
              <Chip tone="gray" className="h-4 px-1 text-[9px]">
                New
              </Chip>
            </td>
          </tr>
          {workers.map((worker) => (
            <tr key={worker.name} className="border-b last:border-0">
              <td className="px-3 py-1.5">{worker.name}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{worker.role}</td>
              <td className="px-2 py-1.5">
                <Chip tone={worker.tone} className="h-4 px-1 text-[9px]">
                  {worker.percent}
                </Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
