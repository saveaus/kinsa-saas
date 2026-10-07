import { Chip } from "@/components/chip"

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
          <p className="px-1.5 py-1">Policies</p>
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

