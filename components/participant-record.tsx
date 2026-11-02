"use client"

import { useState, type ReactNode } from "react"
import { BadgeCheck, ChevronDown, ClipboardList, Ellipsis, FileText, Hash, Plus, User } from "lucide-react"
import Link from "next/link"

import { ActionForm } from "@/components/action-form"
import { AddIncidentDialog } from "@/components/add-incident-dialog"
import { AddParticipantRecordDialog } from "@/components/add-participant-record-dialog"
import { AddSupportPlanCheckDialog } from "@/components/add-support-plan-check-dialog"
import { BackLink } from "@/components/back-link"
import { Chip, type ChipTone } from "@/components/chip"
import { ComplianceGraph } from "@/components/compliance-graph"
import { EmptyState } from "@/components/empty-state"
import { IncidentFileButton } from "@/components/incident-actions"
import { ParticipantActiveChip } from "@/components/participant-active-chip"
import { ParticipantFileButton } from "@/components/participant-record-actions"
import { RecordStatusMenu, type RecordStatusTarget } from "@/components/record-status-menu"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
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
import { formatPersonLabel } from "@/lib/person-name"
import type { IncidentKind } from "@/modules/incidents/standing"
import type { ParticipantActionState } from "@/modules/participants/actions"
import type { ParticipantRecordKind } from "@/modules/participants/standing"
import type { SupportPlanOption } from "@/modules/support-plan-checks/queries"

type ActivityEvent = {
  id: string
  year: string
  period: string
  sentence: string
  when: string
}

export type ParticipantDocumentRow = {
  id: string
  filename: string
  mimeType: string
  detail: string
  draft: boolean
  label: string
  tone: ChipTone
  acceptedLabel: string
  acceptedTone: ChipTone
}

export type ParticipantEntryRow = {
  id: string
  title: string
  detail: string
  draft: boolean
  label: string
  tone: ChipTone
  acceptedLabel: string
  acceptedTone: ChipTone
  target: RecordStatusTarget
  view:
    | {
        kind: "incident"
        incidentKind: IncidentKind
        summary: string
        filename: string
        mimeType: string
      }
    | { kind: "link"; href: string }
}

type AddChoice =
  | { type: "record"; kind: ParticipantRecordKind }
  | { type: "incident"; kind: IncidentKind }
  | { type: "check" }

export function ParticipantRecord({
  id,
  name,
  ndisNumber,
  active,
  canDelete,
  score,
  percent,
  activity,
  activityNewerHref,
  activityOlderHref,
  documents,
  entries,
  registers,
  plans,
  updateAction,
  deleteAction,
}: {
  id: string
  name: string
  ndisNumber: string
  active: boolean
  canDelete: boolean
  score: string
  percent: number
  activity: ActivityEvent[]
  activityNewerHref?: string | null
  activityOlderHref?: string | null
  documents: ParticipantDocumentRow[]
  entries: ParticipantEntryRow[]
  registers: { kind: IncidentKind; label: string }[]
  plans: SupportPlanOption[]
  updateAction: (state: ParticipantActionState, formData: FormData) => Promise<ParticipantActionState>
  deleteAction: (state: ParticipantActionState, formData: FormData) => Promise<ParticipantActionState>
}) {
  const [tab, setTab] = useState("activity")
  const [add, setAdd] = useState<AddChoice | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [standingOpen, setStandingOpen] = useState(true)
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
  const words = name.trim().split(/\s+/).filter(Boolean)
  const initials = words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase()

  function chooseAdd(choice: AddChoice, nextTab: string) {
    setTab(nextTab)
    setAdd(choice)
  }

  return (
    <div data-participant-record="" className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <BackLink href="/participants" />
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-[11px] font-semibold text-foreground">
            {initials || "P"}
          </span>
          <h2 className="truncate text-[15px] font-medium">{name}</h2>
        </div>
        {canDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ size: "sm", variant: "outline" })} aria-label="More actions">
              <Ellipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                Delete participant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <p className="flex h-8 shrink-0 items-center truncate px-4 text-xs text-muted-foreground">NDIS {ndisNumber}</p>
          <Tabs value={tab} onValueChange={setTab} className="min-h-0 min-w-0 flex-1 gap-0 overflow-hidden">
              <div className="flex h-11 shrink-0 items-end gap-2 border-b px-4">
                <TabsList variant="line" className="h-9 min-w-0 flex-1 justify-start px-0">
                  <TabsTrigger value="activity" className="flex-none px-2.5 text-[13px] font-normal">
                    Activity
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="flex-none px-2.5 text-[13px] font-normal">
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="records" className="flex-none px-2.5 text-[13px] font-normal">
                    Records
                  </TabsTrigger>
                </TabsList>
                <DropdownMenu>
                  <DropdownMenuTrigger className={`${buttonVariants({ size: "sm", variant: "outline" })} mb-2`}>
                    <Plus />
                    Add
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => chooseAdd({ type: "record", kind: "service_agreement" }, "documents")}>
                      Service agreement
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => chooseAdd({ type: "record", kind: "support_plan" }, "documents")}>
                      Support plan
                    </DropdownMenuItem>
                    {registers.map((register) => (
                      <DropdownMenuItem
                        key={register.kind}
                        onClick={() => chooseAdd({ type: "incident", kind: register.kind }, "records")}
                      >
                        {register.label}
                      </DropdownMenuItem>
                    ))}
                    {plans.length > 0 ? (
                      <DropdownMenuItem onClick={() => chooseAdd({ type: "check" }, "records")}>
                        Support plan check
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto px-2 pt-4">
                  {groups.length === 0 ? (
                    <EmptyState className="py-12" title="No activity yet" description="Updates for this participant will show up here." />
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
                  {documents.length === 0 ? (
                    <EmptyState
                      className="py-12"
                      icon={<FileText className="size-4" />}
                      title="No documents"
                      description="Attach the service agreement and the support plan."
                      action={
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            className={buttonVariants({ size: "sm" })}
                            onClick={() => setAdd({ type: "record", kind: "service_agreement" })}
                          >
                            <Plus />
                            Add agreement
                          </button>
                          <button
                            type="button"
                            className={buttonVariants({ size: "sm", variant: "outline" })}
                            onClick={() => setAdd({ type: "record", kind: "support_plan" })}
                          >
                            <Plus />
                            Add plan
                          </button>
                        </div>
                      }
                    />
                  ) : (
                    <ul>
                      {documents.map((file) => (
                        <li
                          key={file.id}
                          className="grid h-9 grid-cols-[1rem_minmax(0,1fr)_7.5rem_11rem_4.25rem] items-center gap-x-3 rounded-md px-2 text-sm hover:bg-muted/60"
                        >
                          <FileText className="size-4 text-muted-foreground" />
                          <span className="min-w-0 truncate">{file.filename}</span>
                          <RecordStatusMenu
                            draft={file.draft}
                            label={file.label}
                            tone={file.tone}
                            acceptedLabel={file.acceptedLabel}
                            acceptedTone={file.acceptedTone}
                            target={{ kind: "participantRecord", id: file.id }}
                          />
                          <span className="truncate text-muted-foreground">{file.detail}</span>
                          <span className="justify-self-end">
                            <ParticipantFileButton
                              participantId={id}
                              recordId={file.id}
                              filename={file.filename}
                              mimeType={file.mimeType}
                            />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
              </TabsContent>
              <TabsContent value="records" className="min-h-0 flex-1 overflow-y-auto px-2 pt-3">
                  {entries.length === 0 ? (
                    <EmptyState
                      className="py-12"
                      icon={<ClipboardList className="size-4" />}
                      title="No records"
                      description="Incidents, complaints, risks, and log entries for this participant show up here."
                    />
                  ) : (
                    <ul>
                      {entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="grid h-9 grid-cols-[1rem_minmax(0,1fr)_7.5rem_11rem_4.25rem] items-center gap-x-3 rounded-md px-2 text-sm hover:bg-muted/60"
                        >
                          <ClipboardList className="size-4 text-muted-foreground" />
                          <span className="min-w-0 truncate">{entry.title}</span>
                          <RecordStatusMenu
                            draft={entry.draft}
                            label={entry.label}
                            tone={entry.tone}
                            acceptedLabel={entry.acceptedLabel}
                            acceptedTone={entry.acceptedTone}
                            target={entry.target}
                          />
                          <span className="truncate text-muted-foreground">{entry.detail}</span>
                          <span className="justify-self-end">
                            <EntryView entry={entry} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
              </TabsContent>
          </Tabs>
        </div>

        <aside className="flex h-full min-h-0 flex-col overflow-y-auto border-t lg:border-t-0 lg:border-l">
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
          {detailsOpen ? (
            <DetailsForm
              id={id}
              name={name}
              ndisNumber={ndisNumber}
              active={active}
              updateAction={updateAction}
            />
          ) : null}
          <button
            type="button"
            className="mt-2 flex items-center gap-1 border-t px-3 pt-3 pb-1 text-left text-[13px]"
            onClick={() => setStandingOpen((open) => !open)}
          >
            <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${standingOpen ? "" : "-rotate-90"}`} />
            Standing
          </button>
          {standingOpen ? <ComplianceGraph percent={percent} score={score} /> : null}
        </aside>
      </div>

      <AddParticipantRecordDialog
        participantId={id}
        kind="service_agreement"
        hideTrigger
        open={add?.type === "record" && add.kind === "service_agreement"}
        onOpenChange={(open) => setAdd(open ? { type: "record", kind: "service_agreement" } : null)}
      />
      <AddParticipantRecordDialog
        participantId={id}
        kind="support_plan"
        hideTrigger
        open={add?.type === "record" && add.kind === "support_plan"}
        onOpenChange={(open) => setAdd(open ? { type: "record", kind: "support_plan" } : null)}
      />
      {registers.map((register) => (
        <AddIncidentDialog
          key={register.kind}
          kind={register.kind}
          participantId={id}
          hideTrigger
          open={add?.type === "incident" && add.kind === register.kind}
          onOpenChange={(open) => setAdd(open ? { type: "incident", kind: register.kind } : null)}
        />
      ))}
      {plans.length > 0 ? (
        <AddSupportPlanCheckDialog
          participantId={id}
          plans={plans}
          hideTrigger
          open={add?.type === "check"}
          onOpenChange={(open) => setAdd(open ? { type: "check" } : null)}
        />
      ) : null}

      {canDelete ? (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {name}?</DialogTitle>
              <DialogDescription>
                Remove is only available before a file, incident, support plan check, or log is accepted.
              </DialogDescription>
            </DialogHeader>
            <ActionForm
              action={deleteAction}
              submitLabel="Delete participant"
              pendingLabel="Deleting..."
              submitVariant="destructive"
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

function EntryView({ entry }: { entry: ParticipantEntryRow }) {
  switch (entry.view.kind) {
    case "incident":
      return (
        <IncidentFileButton
          incidentId={entry.id}
          kind={entry.view.incidentKind}
          summary={entry.view.summary}
          filename={entry.view.filename}
          mimeType={entry.view.mimeType}
        />
      )
    case "link":
      return (
        <Link href={entry.view.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open
        </Link>
      )
    default: {
      const unreachable: never = entry.view
      return unreachable
    }
  }
}

function DetailsForm({
  id,
  name,
  ndisNumber,
  active,
  updateAction,
}: {
  id: string
  name: string
  ndisNumber: string
  active: boolean
  updateAction: (state: ParticipantActionState, formData: FormData) => Promise<ParticipantActionState>
}) {
  const [editing, setEditing] = useState<"name" | "ndis" | null>(null)
  const [nextName, setNextName] = useState(name)
  const [nextNdis, setNextNdis] = useState(ndisNumber)
  const dirty = nextName !== name || nextNdis !== ndisNumber

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
      <input type="hidden" name="name" value={nextName} />
      <input type="hidden" name="ndis_number" value={nextNdis} />
      <AttributeRow icon={<User className="size-3.5" />} label="Name">
        {editing === "name" ? (
          <Input
            value={nextName}
            autoFocus
            className="h-7"
            onChange={(event) => setNextName(event.target.value)}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button type="button" className="text-left" onClick={() => setEditing("name")}>
            {formatPersonLabel(nextName)}
          </button>
        )}
      </AttributeRow>
      <AttributeRow icon={<Hash className="size-3.5" />} label="NDIS number">
        {editing === "ndis" ? (
          <Input
            value={nextNdis}
            inputMode="numeric"
            autoFocus
            className="h-7"
            onChange={(event) => setNextNdis(event.target.value.replace(/\D/g, "").slice(0, 9))}
            onBlur={() => setEditing(null)}
          />
        ) : (
          <button type="button" className="text-left" onClick={() => setEditing("ndis")}>
            {nextNdis}
          </button>
        )}
      </AttributeRow>
      <AttributeRow icon={<BadgeCheck className="size-3.5" />} label="Status">
        <ParticipantActiveChip participantId={id} active={active} />
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
