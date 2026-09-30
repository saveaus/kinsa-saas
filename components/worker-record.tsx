"use client"

import { useState, type ReactNode } from "react"
import { Briefcase, ChevronDown, Ellipsis, FileText, GraduationCap, Mail, Plus, Shield, User } from "lucide-react"
import Link from "next/link"
import { Cell, Pie, PieChart } from "recharts"

import { ActionForm } from "@/components/action-form"
import { EmptyState } from "@/components/empty-state"
import { Chip, type ChipTone } from "@/components/chip"
import { DocumentViewButton } from "@/components/document-view-button"
import { enrolmentStatusLabel, enrolmentStatusTone, renewalLabel } from "@/components/course-card"
import { ItemStatusBadge } from "@/components/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
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

type AssignedCourse = {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  status: string
  percent: number
  renewalMonths: number | null
  exam: string
  assigned: string
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
  courses,
  types,
  updateAction,
  deleteAction,
  inviteAction,
  uploadAction,
  csvHref,
  pdfHref,
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
  courses: AssignedCourse[]
  types: Array<{ id: string; name: string }>
  updateAction: (state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>
  deleteAction: (state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>
  inviteAction: ((state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>) | null
  uploadAction: (state: DocumentActionState, formData: FormData) => Promise<DocumentActionState>
  csvHref: string
  pdfHref: string
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
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#E8F0FE] text-xs font-medium text-[#3B6FD8]">
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
          <a href={csvHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Export CSV
          </a>
          <a href={pdfHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Export PDF
          </a>
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
          <Tabs value={tab} onValueChange={setTab} className="min-h-0 min-w-0 flex-1 gap-0 overflow-hidden px-2">
          <TabsList variant="line" className="h-9 w-full shrink-0 justify-start border-b px-2">
            <TabsTrigger value="activity" className="flex-none px-2.5 text-[13px] font-normal">
              Activity
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-none px-2.5 text-[13px] font-normal">
              Documents
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex-none px-2.5 text-[13px] font-normal">
              Courses
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex-none px-2.5 text-[13px] font-normal">
              Compliance
            </TabsTrigger>
          </TabsList>
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
                          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-[#E8F0FE] text-[#3B6FD8]">
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
                  <li key={file.id} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <Chip tone={file.tone}>{file.status}</Chip>
                    <span className="shrink-0 text-muted-foreground">{file.expiry}</span>
                    <DocumentViewButton documentId={file.id} />
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
                <ActionForm action={uploadAction} submitLabel="Add document">
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
          <TabsContent value="courses" className="min-h-0 flex-1 overflow-y-auto px-2 pt-3">
            {courses.length === 0 ? (
              <EmptyState
                className="py-12"
                icon={<GraduationCap className="size-4" />}
                title="No courses assigned"
                description="Assigned courses will show up here."
                action={
                  canManage ? (
                    <Link href="/courses" className={buttonVariants({ size: "sm" })}>
                      Assign a course
                    </Link>
                  ) : null
                }
              />
            ) : (
              <ul>
                {courses.map((course) => {
                  const row = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{course.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {course.percent}% · {course.exam === "—" ? "Exam not sat" : course.exam}
                          {renewalLabel(course.renewalMonths) ? ` · ${renewalLabel(course.renewalMonths)}` : ""} · Assigned{" "}
                          {course.assigned}
                        </span>
                      </span>
                      <Chip tone={enrolmentStatusTone(course.status)}>{enrolmentStatusLabel(course.status)}</Chip>
                    </>
                  )
                  const className = "flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
                  if (course.status === "completed") {
                    return (
                      <li key={course.id}>
                        <Link href={`/certificates/${course.id}`} className={className}>
                          {row}
                        </Link>
                      </li>
                    )
                  }
                  return (
                    <li key={course.id} className={className}>
                      {row}
                    </li>
                  )
                })}
              </ul>
            )}
          </TabsContent>
          <TabsContent value="compliance" className="min-h-0 flex-1 overflow-y-auto px-2 pt-3">
            <ComplianceList
              points={points}
              onOpenDocuments={() => {
                setTab("documents")
                setUploadOpen(true)
              }}
              onOpenCourses={() => setTab("courses")}
            />
          </TabsContent>
        </Tabs>
        </div>

        <aside className="flex h-full min-h-0 flex-col overflow-hidden border-t lg:border-t-0 lg:border-l">
          <div className="hidden h-8 lg:block" />
          <div className="flex h-9 items-end border-b px-3">
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
            <DetailsForm fields={fields} canManage={canManage} updateAction={updateAction} />
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
                Their name, email, and login are removed, and their documents and course history are cleared. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <ActionForm action={deleteAction} submitLabel="Delete worker" pendingLabel="Deleting..." submitVariant="destructive" />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

const complianceChartConfig = {
  met: { label: "Current", color: "#7BC96F" },
  rest: { label: "Remaining", theme: { light: "#F1F2F4", dark: "#32363C" } },
} satisfies ChartConfig

function ComplianceGraph({ percent, score }: { percent: number; score: string }) {
  const current = Math.max(0, Math.min(100, percent))
  const data = [
    { key: "met", value: current },
    { key: "rest", value: 100 - current },
  ]

  return (
    <div className="overflow-hidden px-3 pb-4">
      <div className="relative mx-auto size-40">
        <ChartContainer config={complianceChartConfig} className="aspect-square size-40">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              innerRadius={54}
              outerRadius={72}
              startAngle={90}
              endAngle={-270}
              stroke="none"
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={`var(--color-${entry.key})`} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[22px] font-medium">{current}%</p>
      </div>
      <p className="text-center text-xs text-muted-foreground">{score} requirements current</p>
    </div>
  )
}

function ComplianceList({
  points,
  onOpenDocuments,
  onOpenCourses,
}: {
  points: CompliancePoint[]
  onOpenDocuments: () => void
  onOpenCourses: () => void
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
        if (point.href === "#courses") {
          return (
            <li key={point.key}>
              <button type="button" className={`${className} w-full text-left`} onClick={onOpenCourses}>
                {body}
              </button>
            </li>
          )
        }
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

function DetailsForm({
  fields,
  canManage,
  updateAction,
}: {
  fields: WorkerFields
  canManage: boolean
  updateAction: (state: WorkerActionState, formData: FormData) => Promise<WorkerActionState>
}) {
  const [editing, setEditing] = useState<"firstName" | "lastName" | "email" | "employment" | null>(null)
  const [firstName, setFirstName] = useState(fields.firstName)
  const [lastName, setLastName] = useState(fields.lastName)
  const [email, setEmail] = useState(fields.email)
  const [employment, setEmployment] = useState(fields.employment)
  const [staffRoles, setStaffRoles] = useState(fields.staffRoles)
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
            {firstName}
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
            {lastName}
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
        {editing === "employment" && canManage ? (
          <select
            value={employment}
            autoFocus
            className="h-7 rounded-md border border-input bg-transparent px-2 text-sm"
            onChange={(event) => {
              const value = event.target.value
              if (value === "active" || value === "inactive") setEmployment(value)
            }}
            onBlur={() => setEditing(null)}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        ) : (
          <button type="button" onClick={() => canManage && setEditing("employment")}>
            <Chip tone={employment === "active" ? "green" : "gray"}>
              {employment === "active" ? "Active" : "Inactive"}
            </Chip>
          </button>
        )}
      </AttributeRow>
      <AttributeRow icon={<User className="size-3.5" />} label="Roles">
        {staffRoles.map((role) => (
          <input key={role} type="hidden" name="staff_roles" value={role} />
        ))}
        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex max-w-full flex-wrap gap-1 text-left">
              {staffRoles.map((role) => (
                <Chip key={role} tone="blue">
                  {staffRoleLabel(role)}
                </Chip>
              ))}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {STAFF_ROLES.map((role) => (
                <DropdownMenuCheckboxItem
                  key={role}
                  checked={staffRoles.includes(role)}
                  closeOnClick={false}
                  onCheckedChange={(checked) => {
                    const next = checked
                      ? [...staffRoles, role]
                      : staffRoles.filter((item) => item !== role)
                    const roles = STAFF_ROLES.filter((item) => next.includes(item))
                    if (roles.length === 0) return
                    setStaffRoles(roles)
                  }}
                >
                  {staffRoleLabel(role)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <span className="flex flex-wrap gap-1">
            {staffRoles.map((role) => (
              <Chip key={role} tone="blue">
                {staffRoleLabel(role)}
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
