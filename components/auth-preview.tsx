import { Chip } from "@/components/chip"
import { OrgMark, organisationInitials } from "@/components/org-mark"
import { NDIS_REGISTRATION_GROUPS } from "@/lib/ndis-registration-groups"

const workers = [
  { name: "Alex Chen", role: "Support worker", percent: "25%", tone: "yellow" as const },
  { name: "Sam Patel", role: "Support worker", percent: "100%", tone: "green" as const },
  { name: "Jordan Lee", role: "Team leader", percent: "0%", tone: "red" as const },
  { name: "Riley Nguyen", role: "Complex care", percent: "51%", tone: "yellow" as const },
]

const nav = ["Dashboard", "Tasks", "Workers", "Policies", "Logs", "Evidence"]

type Focus = "person" | "workspace" | "groups"

function activeNav(focus: Focus) {
  switch (focus) {
    case "person":
      return "Workers"
    case "groups":
      return "Policies"
    case "workspace":
      return null
    default: {
      const exhaustive: never = focus
      return exhaustive
    }
  }
}

export function AccountPreview({ name }: { name: string }) {
  const label = name.trim()
  return <WorkspaceShot workspace="Workspace" person={label || "You"} account={label || null} focus="person" />
}

export function OrganisationPreview({
  name,
  logoUrl = null,
  registrationGroups = [],
  abn,
  registrationNumber,
  focus,
}: {
  name: string
  logoUrl?: string | null
  registrationGroups?: string[]
  abn?: string
  registrationNumber?: string
  focus: "workspace" | "groups"
}) {
  return (
    <WorkspaceShot
      workspace={name.trim() || "Your organisation"}
      logoUrl={logoUrl}
      focus={focus}
      groups={registrationGroups}
      abn={abn}
      registrationNumber={registrationNumber}
    />
  )
}

function WorkspaceShot({
  workspace,
  logoUrl = null,
  person,
  account = null,
  groups = [],
  abn,
  registrationNumber,
  focus,
}: {
  workspace: string
  logoUrl?: string | null
  person?: string
  account?: string | null
  groups?: string[]
  abn?: string
  registrationNumber?: string
  focus: Focus
}) {
  const labelled = groups
    .map((code) => NDIS_REGISTRATION_GROUPS.find((group) => group.code === code))
    .filter((group) => group !== undefined)

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute top-8 right-0 bottom-0 left-6 overflow-hidden rounded-tl-xl border bg-background shadow-sm [mask-image:linear-gradient(black,black_78%,transparent)]">
        <div className="flex h-full">
          <aside className="flex w-36 shrink-0 flex-col border-r bg-sidebar px-2 py-2">
            <div
              className={`flex items-center gap-2 rounded-md px-1.5 py-1.5 ${
                focus === "workspace" ? "ring-2 ring-primary" : ""
              }`}
            >
              <OrgMark name={workspace} logoUrl={logoUrl ?? null} />
              <span className="truncate text-[11px] font-medium">{workspace}</span>
            </div>
            <ul className="mt-3 grid gap-0.5 text-[11px] text-muted-foreground">
              {nav.map((item) => (
                <li
                  key={item}
                  className={`rounded-md px-1.5 py-1 ${activeNav(focus) === item ? "bg-sidebar-accent text-foreground" : ""}`}
                >
                  {item}
                </li>
              ))}
            </ul>
            {account ? (
              <div className="mt-3 flex items-center gap-1.5 border-t px-1.5 pt-2">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[8px] font-medium text-primary">
                  {organisationInitials(account)}
                </span>
                <span className="truncate text-[11px]">{account}</span>
              </div>
            ) : null}
          </aside>
          <div className="min-w-0 flex-1">
            {focus === "person" ? <PeoplePreview person={person ?? "You"} /> : null}
            {focus === "workspace" ? (
              <DetailsPreview workspace={workspace} abn={abn} registrationNumber={registrationNumber} />
            ) : null}
            {focus === "groups" ? <GroupsPreview groups={labelled} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function PeoplePreview({ person }: { person: string }) {
  return (
    <div>
      <div className="flex items-center justify-between border-b px-3 py-2">
        <p className="text-[11px] font-medium">Workers</p>
        <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] text-background">Add worker</span>
      </div>
      <table className="w-full text-left text-[10px]">
        <thead className="text-muted-foreground">
          <tr className="border-b">
            <th className="px-3 py-1.5 font-normal">Name</th>
            <th className="px-2 py-1.5 font-normal">Role</th>
            <th className="px-2 py-1.5 font-normal">Compliance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b ring-2 ring-primary ring-inset">
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

function DetailsPreview({
  workspace,
  abn,
  registrationNumber,
}: {
  workspace: string
  abn?: string
  registrationNumber?: string
}) {
  return (
    <div className="px-4 py-4">
      <p className="text-[11px] font-medium">Business details</p>
      <p className="mt-1 text-[10px] text-muted-foreground">Printed on training certificates.</p>
      <dl className="mt-3 grid gap-2 text-[11px]">
        <div>
          <dt className="text-muted-foreground">Organisation</dt>
          <dd className="font-medium">{workspace}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">ABN</dt>
          <dd>{abn?.trim() || "Not added"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">NDIS registration</dt>
          <dd>{registrationNumber?.trim() || "Not added"}</dd>
        </div>
      </dl>
    </div>
  )
}

function GroupsPreview({ groups }: { groups: { code: string; name: string }[] }) {
  return (
    <div className="m-3 rounded-lg ring-2 ring-primary">
      <p className="border-b px-3 py-2 text-[11px] font-medium">Registration groups</p>
      {groups.length === 0 ? (
        <p className="px-3 py-3 text-[10px] text-muted-foreground">Select the services you are registered for.</p>
      ) : (
        <ul className="text-[10px]">
          {groups.slice(0, 6).map((group) => (
            <li key={group.code} className="border-b px-3 py-1.5 last:border-0">
              <span className="font-medium tabular-nums">{group.code}</span>
              <span className="text-muted-foreground"> {group.name}</span>
            </li>
          ))}
          {groups.length > 6 ? (
            <li className="px-3 py-1.5 text-muted-foreground">+{groups.length - 6} more</li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
