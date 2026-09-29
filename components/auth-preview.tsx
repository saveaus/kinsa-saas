import { Chip, type ChipTone } from "@/components/chip"

const workers = [
  { name: "Alex Chen", role: "Support worker", compliance: "12/48", percent: "25%", tone: "yellow" as const },
  { name: "Sam Patel", role: "Support worker", compliance: "48/48", percent: "100%", tone: "green" as const },
  { name: "Jordan Lee", role: "Team leader", compliance: "0/52", percent: "0%", tone: "red" as const },
  { name: "Riley Nguyen", role: "Complex care", compliance: "31/61", percent: "51%", tone: "yellow" as const },
  { name: "Casey Brooks", role: "Office", compliance: "8/8", percent: "100%", tone: "green" as const },
]

export function AccountPreview({ name }: { name: string }) {
  const label = name.trim() || "You"
  return (
    <PreviewChrome title="Workers">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-[11px] font-medium">All workers</p>
        <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] text-background">+ Add worker</span>
      </div>
      <table className="w-full text-left text-[10px]">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-1.5 font-normal">Name</th>
            <th className="px-2 py-1.5 font-normal">Roles</th>
            <th className="px-2 py-1.5 font-normal">Compliance</th>
            <th className="px-2 py-1.5 font-normal">Percent</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b ring-2 ring-[#2665F0] ring-inset">
            <td className="px-3 py-1.5 font-medium">{label}</td>
            <td className="px-2 py-1.5 text-muted-foreground">Administrator</td>
            <td className="px-2 py-1.5">—</td>
            <td className="px-2 py-1.5">
              <Chip tone="gray" className="h-4 px-1 text-[9px]">
                New
              </Chip>
            </td>
          </tr>
          {workers.slice(0, 4).map((worker) => (
            <tr key={worker.name} className="border-b last:border-0">
              <td className="px-3 py-1.5">{worker.name}</td>
              <td className="px-2 py-1.5 text-muted-foreground">{worker.role}</td>
              <td className="px-2 py-1.5">{worker.compliance}</td>
              <td className="px-2 py-1.5">
                <Chip tone={worker.tone} className="h-4 px-1 text-[9px]">
                  {worker.percent}
                </Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-[10px] text-muted-foreground">Joins as the organisation administrator.</p>
    </PreviewChrome>
  )
}

export function OrganisationPreview({
  name,
  registrationGroups = [],
}: {
  name: string
  registrationGroups?: string[]
}) {
  const workspace = name.trim() || "Your organisation"
  const count = registrationGroups.length
  return (
    <PreviewChrome title={workspace} highlightTitle>
      <div className="flex">
        <div className="w-28 shrink-0 border-r bg-muted/40 px-2 py-2 text-[10px] text-muted-foreground">
          <p className="truncate px-1 font-medium text-foreground">{workspace}</p>
          <p className="mt-2 rounded bg-background px-1.5 py-1 text-foreground">Workers</p>
          <p className="px-1.5 py-1">Courses</p>
          <p className="px-1.5 py-1">Approvals</p>
          <p className="px-1.5 py-1">Evidence</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="border-b px-3 py-2 text-[11px] font-medium">Registration groups</div>
          {count === 0 ? (
            <p className="px-3 py-3 text-[10px] text-muted-foreground">Select the services you are registered for.</p>
          ) : (
            <ul className="text-[10px]">
              {registrationGroups.slice(0, 5).map((code) => (
                <li key={code} className="border-b px-3 py-1.5 last:border-0">
                  <span className="font-medium tabular-nums">{code}</span>
                </li>
              ))}
              {count > 5 ? (
                <li className="px-3 py-1.5 text-muted-foreground">+{count - 5} more</li>
              ) : null}
            </ul>
          )}
        </div>
      </div>
    </PreviewChrome>
  )
}

const dashboardCounts = {
  compliant: 128,
  lapsing: 19,
  pending: 11,
  noncompliant: 7,
} as const

const dashboardSeries = [
  { key: "compliant", label: "Compliant", tone: "green" as const, fill: "#7BC96F" },
  { key: "lapsing", label: "Lapsing", tone: "yellow" as const, fill: "#F5C451" },
  { key: "pending", label: "Pending review", tone: "orange" as const, fill: "#F0A15A" },
  { key: "noncompliant", label: "Not compliant", tone: "red" as const, fill: "#E57A72" },
] as const

const courseRows = [
  { worker: "Alex Chen", item: "Fire safety refresher", status: "Lapsing", tone: "yellow" as const },
  { worker: "Jordan Lee", item: "Infection prevention", status: "Missing", tone: "red" as const },
  { worker: "Riley Nguyen", item: "Manual handling", status: "Pending review", tone: "orange" as const },
] as const

const documentRows = [
  { worker: "Sam Patel", item: "Working with Children Check", status: "Current", tone: "green" as const },
  { worker: "Casey Brooks", item: "First Aid", status: "Lapsing", tone: "yellow" as const },
  { worker: "Alex Chen", item: "NDIS Worker Screening", status: "Missing", tone: "red" as const },
] as const

export function LoginPreview() {
  const max = Math.max(...Object.values(dashboardCounts))

  return (
    <div className="w-full max-w-[560px]">
      <PreviewChrome title="Harbour Care Collective">
        <div className="bg-[#f7f8f9] p-3 dark:bg-muted/30">
          <div className="mb-3">
            <p className="text-[12px] font-medium tracking-tight">Workforce overview</p>
            <p className="text-[10px] text-muted-foreground">Evidence readiness for Harbour Care Collective.</p>
          </div>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <span className="size-2 rounded-[3px] bg-emerald-500" aria-hidden />
              <p className="text-[11px] font-medium">Workforce status</p>
            </div>
            <div className="grid gap-3 px-3 py-3">
              <div className="flex flex-wrap gap-1">
                {dashboardSeries.map((item) => (
                  <Chip key={item.key} tone={item.tone} className="h-5 text-[9px]">
                    {item.label} {dashboardCounts[item.key]}
                  </Chip>
                ))}
              </div>
              <div className="flex h-20 items-end gap-2 border-b border-border pb-px">
                {dashboardSeries.map((item) => {
                  const count = dashboardCounts[item.key]
                  const height = Math.max(10, (count / max) * 100)
                  return (
                    <div key={item.key} className="flex h-full flex-1 items-end justify-center">
                      <div className="w-7 rounded-t-md" style={{ height: `${height}%`, backgroundColor: item.fill }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex gap-2 text-center text-[9px] text-muted-foreground">
                {dashboardSeries.map((item) => (
                  <span key={item.key} className="flex-1 truncate">
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <MiniTable title="Courses" rows={courseRows} />
          <MiniTable title="Documents" rows={documentRows} />
        </div>
      </PreviewChrome>
    </div>
  )
}

function MiniTable({
  title,
  rows,
}: {
  title: string
  rows: ReadonlyArray<{ worker: string; item: string; status: string; tone: ChipTone }>
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-[11px] font-medium">{title}</p>
        <span className="text-[9px] text-muted-foreground">Search</span>
      </div>
      <table className="w-full text-left text-[9px]">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-1.5 font-normal">Worker</th>
            <th className="px-2 py-1.5 font-normal">Item</th>
            <th className="px-2 py-1.5 font-normal">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.worker}-${row.item}`} className="border-b last:border-0">
              <td className="px-3 py-1.5 font-medium">{row.worker}</td>
              <td className="max-w-[9rem] truncate px-2 py-1.5 text-muted-foreground">{row.item}</td>
              <td className="px-2 py-1.5">
                <Chip tone={row.tone} className="h-4 px-1 text-[8px]">
                  {row.status}
                </Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PreviewChrome({
  title,
  highlightTitle = false,
  children,
}: {
  title: string
  highlightTitle?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative w-[560px] rounded-xl border bg-background shadow-[0_20px_50px_-24px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-[11px]">
        <span className="size-4 rounded-[4px] bg-foreground text-center text-[8px] leading-4 font-semibold text-background">
          K
        </span>
        <span className={highlightTitle ? "truncate rounded-md px-1 font-medium ring-2 ring-[#2665F0]" : "truncate font-medium"}>
          {title}
        </span>
        <span className="text-muted-foreground">▾</span>
      </div>
      {children}
    </div>
  )
}

