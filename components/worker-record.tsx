"use client"

import { useState, type ReactNode } from "react"
import { Briefcase, Mail, Plus, Shield, User } from "lucide-react"
import Link from "next/link"

import { ActionForm } from "@/components/action-form"
import { Chip, type ChipTone } from "@/components/chip"
import { CourseCard, enrolmentStatusLabel, enrolmentStatusTone, renewalLabel } from "@/components/course-card"
import { RecordTable, type RecordRow } from "@/components/record-table"
import { ItemStatusBadge } from "@/components/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
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
import { RoleCheckboxes } from "@/components/role-checkboxes"
import type { ComplianceItemStatus } from "@/modules/documents/compliance"
import { sameRoles, type StaffRole } from "@/modules/workforce/roles"
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
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-md bg-[#E6F0FE] text-sm font-medium text-[#2F5FBF]">
            {initials}
          </span>
          <div>
            <h2 className="text-base font-medium">{name}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {inviteAction ? (
            <ActionForm
              action={inviteAction}
              submitLabel="Invite"
              pendingLabel="Sending..."
              submitVariant="outline"
              submitSize="sm"
              className="gap-0"
            />
          ) : null}
          <a href={csvHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Export CSV
          </a>
          <a href={pdfHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
            Export PDF
          </a>
        </div>
      </div>

      <div className="grid items-start border-t lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0 gap-0 py-3 pr-4">
          <TabsList variant="line" className="h-8 w-full justify-start border-b">
            <TabsTrigger value="activity" className="flex-none px-3">
              Activity
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-none px-3">
              Documents
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex-none px-3">
              Courses
            </TabsTrigger>
          </TabsList>
          <TabsContent value="activity" className="pt-4">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <div className="grid gap-5">
                {groups.map((group) => (
                  <section key={`${group.year}-${group.period}`} className="grid gap-2">
                    <p className="text-xs text-muted-foreground">
                      {group.year}
                      <span className="mt-1 block text-sm text-foreground">{group.period}</span>
                    </p>
                    <ul className="grid gap-2">
                      {group.events.map((event) => (
                        <li key={event.id} className="flex items-start justify-between gap-3 text-sm">
                          <span className="flex items-start gap-2">
                            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#7BC96F]" />
                            {event.sentence}
                          </span>
                          <span className="shrink-0 text-muted-foreground">{event.when}</span>
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
          <TabsContent value="documents" className="pt-4">
            <RecordTable
              title="Documents"
              actions={
                canManage ? (
                  <Button size="sm" onClick={() => setUploadOpen(true)}>
                    <Plus />
                    Add document
                  </Button>
                ) : null
              }
              columns={[
                { id: "type", label: "Type" },
                { id: "status", label: "Status" },
                { id: "expiry", label: "Expiry" },
                { id: "file", label: "File", locked: true },
              ]}
              rows={files.map(
                (file): RecordRow => ({
                  id: file.id,
                  cells: {
                    type: { kind: "text", text: file.name },
                    status: { kind: "chip", text: file.status, tone: file.tone },
                    expiry: { kind: "text", text: file.expiry },
                    file: { kind: "document", text: "View", documentId: file.id },
                  },
                })
              )}
              empty="No documents"
            />
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
          <TabsContent value="courses" className="pt-4">
            {courses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No courses assigned.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {courses.map((course) => (
                  <CourseCard
                    key={course.id}
                    href={
                      course.status === "completed"
                        ? `/certificates/${course.id}`
                        : undefined
                    }
                    title={course.title}
                    description={course.description}
                    imageSrc={course.coverImage}
                    progress={course.percent}
                    chips={[
                      { label: enrolmentStatusLabel(course.status), tone: enrolmentStatusTone(course.status) },
                      { label: course.exam === "—" ? "Exam not sat" : course.exam, tone: "mint" },
                      ...(course.status === "completed"
                        ? [{ label: "Certificate", tone: "green" as const }]
                        : []),
                      ...(renewalLabel(course.renewalMonths)
                        ? [{ label: renewalLabel(course.renewalMonths) as string, tone: "orange" as const }]
                        : []),
                      { label: `Assigned ${course.assigned}`, tone: "gray" },
                    ]}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <aside className="grid content-start gap-1 border-t py-3 lg:border-t-0 lg:border-l lg:pl-4">
          <p className="px-2 pb-1 text-sm font-medium">Record details</p>
          <DetailsForm fields={fields} canManage={canManage} updateAction={updateAction} />
          <p className="px-2 pt-4 pb-1 text-sm font-medium">Compliance</p>
          {points.map((point) => {
            const className =
              "grid grid-cols-[1.1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
            const body = (
              <>
                <Shield className="size-3.5 text-muted-foreground" />
                <span className="truncate">{point.label}</span>
                <ItemStatusBadge status={point.status} />
              </>
            )
            if (point.href === "#upload" || point.href === "#courses") {
              return (
                <button
                  key={point.key}
                  type="button"
                  className={className}
                  onClick={() => {
                    if (point.href === "#courses") {
                      setTab("courses")
                      return
                    }
                    setTab("documents")
                    setUploadOpen(true)
                  }}
                >
                  {body}
                </button>
              )
            }
            return (
              <Link key={point.key} href={point.href} className={className}>
                {body}
              </Link>
            )
          })}
          {canManage ? (
            <div className="px-2 pt-4">
              <ActionForm
                action={deleteAction}
                submitLabel="Delete worker"
                submitVariant="destructive"
                submitSize="sm"
                className="gap-0"
              />
            </div>
          ) : null}
        </aside>
      </div>
    </div>
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
      className="gap-0"
      hideSubmit={!dirty}
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
      <div className="grid gap-2 px-2 py-1.5 text-sm">
        <RoleCheckboxes
          legend="Roles"
          selected={staffRoles}
          onChange={canManage ? setStaffRoles : undefined}
          disabled={!canManage}
        />
        <p className="text-xs text-muted-foreground">Scored only against the roles selected here.</p>
      </div>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Shield className="size-3.5" />
          Login
        </span>
        <Chip tone={fields.loginLinked ? "green" : "gray"}>{fields.loginLinked ? "Linked" : "No login"}</Chip>
      </div>
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
        <span className="text-muted-foreground">Score</span>
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[#F1F2F4]">
            <span className="block h-full rounded-full bg-[#7BC96F]" style={{ width: `${fields.percent}%` }} />
          </span>
          {fields.score}
        </span>
      </div>
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
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-2 px-2 py-1 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
