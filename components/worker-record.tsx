"use client"

import { useState, type ReactNode } from "react"
import { Briefcase, ChevronDown, Ellipsis, FileText, Mail, Plus, Shield, User } from "lucide-react"
import Link from "next/link"

import { ActionForm } from "@/components/action-form"
import { BackLink } from "@/components/back-link"
import { ComplianceGraph } from "@/components/compliance-graph"
import { EmptyState } from "@/components/empty-state"
import { Chip, type ChipTone } from "@/components/chip"
import { DocumentViewButton } from "@/components/document-view-button"
import { ItemStatusBadge } from "@/components/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatPersonLabel } from "@/lib/person-name"
import type { ComplianceItemStatus } from "@/modules/documents/compliance"
import { STAFF_ROLES, sameRoles, staffRoleLabel, type StaffRole } from "@/modules/workforce/roles"
import type { WorkerActionState } from "@/modules/workers/actions"
import type { DocumentActionState } from "@/modules/documents/actions"

type ActivityEvent = {
  id: string
  year: string
  period: string
  sentence: string
  when: string
}

type CompliancePoint = {
  key: string
  label: string
  status: ComplianceItemStatus
  href: string
}

type WorkerFile = {
  id: string
  name: string
  status: string
  tone: ChipTone
  expiry: string
}

type WorkerFields = {
  firstName: string
  lastName: string
  email: string
  employment: "active" | "inactive"
  staffRoles: StaffRole[]
  loginLinked: boolean
  score: string
  percent: number
}

export function WorkerRecord({
  name,
  email,
  initials,
  fields,
  canManage,
  activity,
  activityNewerHref,
  activityOlderHref,
  points,
  files,
  types,
  updateAction,
  deleteAction,
  inviteAction,
  uploadAction,
  csvHref,
  pdfHref,
  roleOptions,
}: {
  name: string
  email: string
  initials: string
  fields: WorkerFields
  canManage: boolean
  activity: ActivityEvent[]
  activityNewerHref?: string | null
  activityOlderHref?: string | null
  points: CompliancePoint[]
  files: WorkerFile[]
  types: Array<{ id: string; name: string }>
  updateAction: (state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>
  deleteAction: (state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>
  inviteAction: ((state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>) | null
  uploadAction: (state: DocumentActionState, formData: FormData) => Promise<DocumentActionState>
  csvHref: string
  pdfHref: string
  roleOptions: { code: string; name: string }[]
}) {
  const [tab, setTab] = useState("activity")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [complianceOpen, setComplianceOpen] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const groups = activity.reduce<Array<{ year: string; period: string; events: ActivityEvent[] }>>((list, event) => {
    const last = list.at(-1)
    if (last && last.year === event.year && last.period === event.period) {
      last.events.push(event)
    } else {
      list.push({ year: event.year, period: event.period, events: [event] })
    }
    return list
  }, [])

  return (
    <div data-worker-record="" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <BackLink href="/workers" />
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-foreground">
            {initials}
          </span>
          <h2 className="truncate text-[15px] font-medium">{name}</h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {inviteAction ? (
            <ActionForm
              action={inviteAction}
              submitLabel="Send invite"
              pendingLabel="Sending..."
              submitVariant="outline"
              submitSize="sm"
              className="w-fit gap-0"
            />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ size: "sm", variant: "outline" })}>
              Export
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem render={<a href={csvHref} />}>CSV</DropdownMenuItem>
              <DropdownMenuItem render={<a href={pdfHref} />}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={buttonVariants({ size: "sm", variant: "outline" })} aria-label="More actions">
                <Ellipsis />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                  Delete worker
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <p className="flex h-8 shrink-0 items-center truncate px-4 text-xs text-muted-foreground">{email}</p>
          <Tabs value={tab} onValueChange={setTab} className="min-h-0 min-w-0 flex-1 gap-0 overflow-hidden">
          <div className="flex h-11 shrink-0 items-end gap-2 border-b px-4">
          <TabsList variant="line" className="h-9 min-w-0 flex-1 justify-start px-0">
            <TabsTrigger value="activity" className="flex-none px-2.5 text-[13px] font-normal">
              Activity
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-none px-2.5 text-[13px] font-normal">
              Documents
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex-none px-2.5 text-[13px] font-normal">
              Compliance
            </TabsTrigger>
          </TabsList>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={`${buttonVariants({ size: "sm", variant: "outline" })} mb-2`}>
                <Plus />
                Add
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setTab("documents")
                    setUploadOpen(true)
                  }}
                >
                  Document
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          </div>
          <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto px-2 pt-4">
            {groups.length === 0 ? (
              <EmptyState
                className="py-12"
                title="No activity yet"
                description="Updates for this worker will show up here."
              />
            ) : (
              <div className="grid gap-6">
                {groups.map((group) => (
                  <section key={`${group.year}-${group.period}`} className="grid gap-1">
                    <p className="px-2 text-xs text-muted-foreground">{group.year}</p>
                    <p className="px-2 text-sm">{group.period}</p>
                    <ul>
                      {group.events.map((event) => (
                        <li key={event.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-primary/10 text-primary">
                            <span className="size-1.5 rounded-[2px] bg-current" />
                          </span>
                          <p>
                            {event.sentence} <span className="text-muted-foreground">{event.when}</span>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {activityNewerHref || activityOlderHref ? (
                  <div className="flex justify-end gap-2">
                    {activityNewerHref ? (
                      <Link href={activityNewerHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Newer
                      </Link>
                    ) : null}
                    {activityOlderHref ? (
                      <Link href={activityOlderHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Older
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>
          <TabsContent value="documents" className="min-h-0 flex-1 overflow-y-auto px-2 pt-3">
            {files.length > 0 && canManage ? (
              <div className="mb-1 flex items-center justify-end px-2">
                <Button size="sm" variant="ghost" onClick={() => setUploadOpen(true)}>
                  <Plus />
                  Add document
                </Button>
              </div>
            ) : null}
            {files.length === 0 ? (
              <EmptyState
                className="py-12"
                icon={<FileText className="size-4" />}
                title="No documents"
                description="Upload a PDF or photo. It waits for review."
                action={
                  canManage ? (
                    <Button size="sm" onClick={() => setUploadOpen(true)}>
                      <Plus />
                      Add document
                    </Button>
                  ) : null
                }
              />
            ) : (
              <ul>
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="grid h-9 grid-cols-[1rem_minmax(0,1fr)_7.5rem_11rem_4.25rem] items-center gap-x-3 rounded-md px-2 text-sm hover:bg-muted/60"
                  >
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="min-w-0 truncate">{file.name}</span>
                    <Chip tone={file.tone} className="w-fit max-w-full">
                      {file.status}
                    </Chip>
                    <span className="truncate text-muted-foreground">{file.expiry}</span>
                    <span className="justify-self-end">
                      <DocumentViewButton documentId={file.id} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add document</DialogTitle>
                  <DialogDescription>Upload a file for this worker. It waits for review.</DialogDescription>
                </DialogHeader>
                <ActionForm action={uploadAction} submitLabel="Add document" onSuccess={() => setUploadOpen(false)}>
                  <div className="grid gap-1.5">
                    <Label htmlFor="document_type_version_id">Type</Label>
                    <select
                      id="document_type_version_id"
                      name="document_type_version_id"
                      required
                      className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    >
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="expires_on">Expiry date</Label>
                    <Input id="expires_on" name="expires_on" type="date" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="file">File</Label>
                    <Input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" required />
                  </div>
                </ActionForm>
              </DialogContent>
            </Dialog>
          </TabsContent>
          <TabsContent value="compliance" className="min-h-0 flex-1 overflow-y-auto px-2 pt-3">
            <ComplianceList
              points={points}
              onOpenDocuments={() => {
                setTab("documents")
                setUploadOpen(true)
              }}
            />
          </TabsContent>
        </Tabs>
        </div>

        <aside className="flex h-full min-h-0 flex-col overflow-hidden border-t lg:border-t-0 lg:border-l">
          <div className="hidden h-8 lg:block" />
          <div className="flex h-11 items-end border-b px-3">
            <span className="border-b-2 border-foreground px-1 pb-2 text-[13px]">Details</span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 px-3 pt-3 pb-1 text-left text-[13px]"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${detailsOpen ? "" : "-rotate-90"}`} />
            Record details
          </button>
          <div className={detailsOpen ? "" : "hidden"}>
            <DetailsForm
              fields={fields}
              canManage={canManage}
              updateAction={updateAction}
              roleOptions={roleOptions}
            />
          </div>
          <button
            type="button"
            className="mt-2 flex items-center gap-1 border-t px-3 pt-3 pb-1 text-left text-[13px]"
            onClick={() => setComplianceOpen((open) => !open)}
          >
            <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${complianceOpen ? "" : "-rotate-90"}`} />
            Compliance
          </button>
          {complianceOpen ? <ComplianceGraph percent={fields.percent} score={fields.score} /> : null}
        </aside>
      </div>
      {canManage ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {name}?</DialogTitle>
              <DialogDescription>
                Their name, email, and login are removed, and their documents are cleared. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <ActionForm action={deleteAction} submitLabel="Delete worker" pendingLabel="Deleting..." submitVariant="destructive" />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

function ComplianceList({
  points,
  onOpenDocuments,
}: {
  points: CompliancePoint[]
  onOpenDocuments: () => void
}) {
  if (points.length === 0) {
    return (
      <EmptyState
        className="py-10"
        icon={<Shield className="size-4" />}
        title="No requirements"
        description="Nothing is required for these roles."
      />
    )
  }

  return (
    <ul>
      {points.map((point) => {
        const className = "grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
        const body = (
          <>
            <Shield className="size-3.5 text-muted-foreground" />
            <span className="truncate">{point.label}</span>
            <ItemStatusBadge status={point.status} />
          </>
        )
        if (point.href === "#upload") {
          return (
            <li key={point.key}>
              <button type="button" className={`${className} w-full text-left`} onClick={onOpenDocuments}>
                {body}
              </button>
            </li>
          )
        }
        return (
          <li key={point.key}>
            <Link href={point.href} className={className}>
              {body}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function teamChoices(
  roleOptions: { code: string; name: string }[],
  selected: string[]
) {
  const known = new Set(roleOptions.map((role) => role.code))
  const extras = selected
    .filter((role) => !known.has(role))
    .map((role) => ({ code: role, name: staffRoleLabel(role) }))
  const base =
    roleOptions.length > 0
      ? roleOptions
      : STAFF_ROLES.map((role) => ({ code: role, name: staffRoleLabel(role) }))
  return [...base, ...extras]
}

function DetailsForm({
  fields,
  canManage,
  updateAction,
  roleOptions,
}: {
  fields: WorkerFields
  canManage: boolean
  updateAction: (state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>
  roleOptions: { code: string; name: string }[]
}) {
  const [editing, setEditing] = useState<"firstName" | "lastName" | "email" | null>(null)
  const [firstName, setFirstName] = useState(fields.firstName)
  const [lastName, setLastName] = useState(fields.lastName)
  const [email, setEmail] = useState(fields.email)
  const [employment, setEmployment] = useState(fields.employment)
  const [staffRoles, setStaffRoles] = useState(fields.staffRoles)
  const names = Object.fromEntries(roleOptions.map((item) => [item.code, item.name]))
  const choices = teamChoices(roleOptions, staffRoles)
  const dirty =
    firstName !== fields.firstName ||
    lastName !== fields.lastName ||
    email !== fields.email ||
    employment !== fields.employment ||
    !sameRoles(staffRoles, fields.staffRoles)

  return (
    <ActionForm
      action={updateAction}
      submitLabel="Save"
      submitVariant="outline"
      submitSize="sm"
      className="gap-0 px-1"
      hideSubmit={!dirty}
      submitClassName="mx-2 mb-2"
    >
      <input type="hidden" name="first_name" value={firstName} />
      <input type="hidden" name="last_name" value={lastName} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="employment_status" value={employment} />
      <AttributeRow icon={<User className="size-3.5" />} label="First name">
        {editing === "firstName" && canManage ? (
          <Input
            value={firstName}
            autoFocus
            className="h-7"
            onChange={(event) => setFirstName(event.target.value)}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button type="button" className="text-left" onClick={() => canManage && setEditing("firstName")}>
            {formatPersonLabel(firstName)}
          </button>
        )}
      </AttributeRow>
      <AttributeRow icon={<User className="size-3.5" />} label="Last name">
        {editing === "lastName" && canManage ? (
          <Input
            value={lastName}
            autoFocus
            className="h-7"
            onChange={(event) => setLastName(event.target.value)}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button type="button" className="text-left" onClick={() => canManage && setEditing("lastName")}>
            {formatPersonLabel(lastName)}
          </button>
        )}
      </AttributeRow>
      <AttributeRow icon={<Mail className="size-3.5" />} label="Email">
        {editing === "email" && canManage ? (
          <Input
            type="email"
            value={email}
            autoFocus
            className="h-7"
            onChange={(event) => setEmail(event.target.value)}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button type="button" className="truncate text-left" onClick={() => canManage && setEditing("email")}>
            {email}
          </button>
        )}
      </AttributeRow>
      <AttributeRow icon={<Briefcase className="size-3.5" />} label="Employment">
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex max-w-full flex-wrap gap-1 text-left">
              <Chip tone={employment === "active" ? "green" : "gray"}>
                {employment === "active" ? "Active" : "Inactive"}
              </Chip>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuCheckboxItem
                checked={employment === "active"}
                closeOnClick={false}
                onCheckedChange={(checked) => {
                  if (checked) setEmployment("active")
                }}
              >
                Active
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={employment === "inactive"}
                closeOnClick={false}
                onCheckedChange={(checked) => {
                  if (checked) setEmployment("inactive")
                }}
              >
                Inactive
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Chip tone={employment === "active" ? "green" : "gray"}>
            {employment === "active" ? "Active" : "Inactive"}
          </Chip>
        )}
      </AttributeRow>
      <AttributeRow icon={<User className="size-3.5" />} label="Teams">
        {staffRoles.map((role) => (
          <input key={role} type="hidden" name="staff_roles" value={role} />
        ))}
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex max-w-full flex-wrap gap-1 text-left">
              {staffRoles.map((role) => (
                <Chip key={role} tone="blue">
                  {staffRoleLabel(role, names)}
                </Chip>
              ))}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {choices.map((role) => (
                <DropdownMenuCheckboxItem
                  key={role.code}
                  checked={staffRoles.includes(role.code)}
                  closeOnClick={false}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...staffRoles, role.code]
                      : staffRoles.filter((item) => item !== role.code)
                    const order = teamChoices(roleOptions, next).map((item) => item.code)
                    const roles = order.filter((item) => next.includes(item))
                    if (roles.length === 0) return
                    setStaffRoles(roles)
                  }}
                >
                  {role.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="flex flex-wrap gap-1">
            {staffRoles.map((role) => (
              <Chip key={role} tone="blue">
                {staffRoleLabel(role, names)}
              </Chip>
            ))}
          </span>
        )}
      </AttributeRow>
      <AttributeRow icon={<Shield className="size-3.5" />} label="Login">
        <Chip tone={fields.loginLinked ? "green" : "gray"}>{fields.loginLinked ? "Linked" : "No login"}</Chip>
      </AttributeRow>
      <AttributeRow icon={<Shield className="size-3.5" />} label="Score">
        {fields.score}
      </AttributeRow>
    </ActionForm>
  )
}

function AttributeRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-8 grid-cols-[1rem_8.5rem_minmax(0,1fr)] items-center gap-x-3 rounded-md px-2 py-1 text-[13px] hover:bg-muted/60">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
