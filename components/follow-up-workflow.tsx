"use client"

import { Mail, Plus, Zap } from "lucide-react"
import { useRef, useState, type RefObject } from "react"

import { ActionForm } from "@/components/action-form"
import { Chip } from "@/components/chip"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "cn"
import {
  deleteReminderRuleAction,
  upsertReminderRuleAction,
} from "@/modules/reminders/actions"

export type FollowUpTarget = "any" | "type" | "document"

export type FollowUpChoice = {
  id: string
  label: string
}

export type FollowUpRule = {
  id: string
  target: FollowUpTarget
  typeId: string | null
  documentId: string | null
  label: string
  days: number
  subject: string
  body: string
}

export type FollowUpRun = {
  id: string
  when: string
  title: string
  detail: string
  status: "sent" | "failed"
}

type Block = "trigger" | "email"
type Fields = {
  target: FollowUpTarget
  typeId: string
  documentId: string
  days: string
  subject: string
  body: string
}

const placeholders = [
  { label: "Worker name", token: "{{worker_name}}" },
  { label: "Item", token: "{{item_name}}" },
  { label: "Document", token: "{{document_type}}" },
  { label: "Organisation", token: "{{organisation_name}}" },
  { label: "Expiry date", token: "{{expiry_date}}" },
] as const

function blankFields(types: FollowUpChoice[], documents: FollowUpChoice[]): Fields {
  return {
    target: types.length > 0 ? "type" : "any",
    typeId: types[0]?.id ?? "",
    documentId: documents[0]?.id ?? "",
    days: "30",
    subject: "",
    body: "",
  }
}

function triggerTitle(label: string, target: FollowUpTarget) {
  switch (target) {
    case "any":
      return "Document nearing expiry"
    case "type":
    case "document":
      return label ? `${label} nearing expiry` : "Document nearing expiry"
    default: {
      const unreachable: never = target
      return unreachable
    }
  }
}

function choiceLabel(choices: FollowUpChoice[], id: string) {
  return choices.find((choice) => choice.id === id)?.label ?? ""
}

function parseFollowUpTarget(value: string): FollowUpTarget | null {
  switch (value) {
    case "any":
    case "type":
    case "document":
      return value
    default:
      return null
  }
}

function timingLabel(days: number) {
  if (days === 0) return "On the expiry date"
  if (days === 1) return "1 day before expiry"
  return `${days} days before expiry`
}

function fieldsFromRule(rule: FollowUpRule, types: FollowUpChoice[], documents: FollowUpChoice[]): Fields {
  return {
    target: rule.target,
    typeId: rule.typeId ?? types[0]?.id ?? "",
    documentId: rule.documentId ?? documents[0]?.id ?? "",
    days: String(rule.days),
    subject: rule.subject,
    body: rule.body,
  }
}

function liveLabel(fields: Fields, types: FollowUpChoice[], documents: FollowUpChoice[]) {
  switch (fields.target) {
    case "any":
      return ""
    case "type":
      return choiceLabel(types, fields.typeId)
    case "document":
      return choiceLabel(documents, fields.documentId)
    default: {
      const unreachable: never = fields.target
      return unreachable
    }
  }
}

export function FollowUpWorkflow({
  rules,
  runs,
  types,
  documents,
}: {
  rules: FollowUpRule[]
  runs: FollowUpRun[]
  types: FollowUpChoice[]
  documents: FollowUpChoice[]
}) {
  const [tab, setTab] = useState<"editor" | "runs">("editor")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [block, setBlock] = useState<Block>("trigger")
  const [fields, setFields] = useState<Fields | null>(null)
  const message = useRef<HTMLTextAreaElement>(null)

  function open(id: string, next: Block) {
    setBlock(next)
    if (id === selectedId) return
    setSelectedId(id)
    if (id === "new") {
      setFields(blankFields(types, documents))
      return
    }
    const rule = rules.find((item) => item.id === id)
    if (!rule) return
    setFields(fieldsFromRule(rule, types, documents))
  }

  function close() {
    setSelectedId(null)
    setFields(null)
  }

  function insertPlaceholder(token: string) {
    const field = message.current
    if (!field || !fields) return
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? field.value.length
    const before = fields.body.slice(0, start)
    const after = fields.body.slice(end)
    const lead = before.length > 0 && !/\s$/.test(before) ? " " : ""
    const trail = after.length > 0 && !/^\s/.test(after) ? " " : ""
    const insert = `${lead}${token}${trail}`
    const body = `${before}${insert}${after}`
    setFields({ ...fields, body })
    const cursor = start + insert.length
    requestAnimationFrame(() => {
      field.focus()
      field.setSelectionRange(cursor, cursor)
    })
  }

  return (
    <div data-workflows="" className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-4 border-b px-4">
        <h1 className="text-sm font-medium">Follow-ups</h1>
        <div className="flex items-center gap-1">
          <TabButton current={tab === "editor"} onClick={() => setTab("editor")}>
            Editor
          </TabButton>
          <TabButton current={tab === "runs"} onClick={() => setTab("runs")}>
            Runs
          </TabButton>
        </div>
      </div>
      {tab === "runs" ? (
        <Runs runs={runs} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] bg-[size:18px_18px]">
            <div className="mx-auto flex w-full max-w-md flex-col items-stretch px-4 py-10">
              {rules.length === 0 && selectedId !== "new" ? (
                <p className="mb-6 text-center text-sm text-muted-foreground">
                  A follow-up sends when a document is close to expiry.
                </p>
              ) : null}
              {rules.map((rule) => {
                const live = selectedId === rule.id && fields ? fields : null
                const label = live ? liveLabel(live, types, documents) : rule.label
                const target = live?.target ?? rule.target
                const days = live ? Number(live.days) || 0 : rule.days
                const subject = live?.subject || rule.subject
                return (
                  <WorkflowChain
                    key={rule.id}
                    title={triggerTitle(label, target)}
                    timing={timingLabel(days)}
                    subject={subject || "Send email"}
                    triggerSelected={selectedId === rule.id && block === "trigger"}
                    emailSelected={selectedId === rule.id && block === "email"}
                    onTrigger={() => open(rule.id, "trigger")}
                    onEmail={() => open(rule.id, "email")}
                  />
                )
              })}
              {selectedId === "new" && fields ? (
                <WorkflowChain
                  title={triggerTitle(liveLabel(fields, types, documents), fields.target)}
                  timing={timingLabel(Number(fields.days) || 0)}
                  subject={fields.subject || "New email"}
                  triggerSelected={block === "trigger"}
                  emailSelected={block === "email"}
                  onTrigger={() => setBlock("trigger")}
                  onEmail={() => setBlock("email")}
                />
              ) : null}
              <button
                type="button"
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed bg-background text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => open("new", "trigger")}
              >
                <Plus className="size-4" />
                Add follow-up
              </button>
            </div>
          </div>
          <Inspector
            ruleId={selectedId}
            block={block}
            fields={fields}
            types={types}
            documents={documents}
            messageRef={message}
            onChange={setFields}
            onInsert={insertPlaceholder}
            onSaved={close}
            canDelete={selectedId !== null && selectedId !== "new"}
          />
        </div>
      )}
    </div>
  )
}

function TabButton({
  current,
  onClick,
  children,
}: {
  current: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md px-2 py-1 text-sm",
        current ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
      aria-current={current ? "page" : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function WorkflowChain({
  title,
  timing,
  subject,
  triggerSelected,
  emailSelected,
  onTrigger,
  onEmail,
}: {
  title: string
  timing: string
  subject: string
  triggerSelected: boolean
  emailSelected: boolean
  onTrigger: () => void
  onEmail: () => void
}) {
  return (
    <div className="mb-8 flex flex-col items-stretch">
      <StepCard
        kind="trigger"
        title={title}
        detail={timing}
        selected={triggerSelected}
        onClick={onTrigger}
      />
      <span className="mx-auto h-8 w-px bg-border" aria-hidden />
      <StepCard
        kind="email"
        title="Send email"
        detail={subject}
        selected={emailSelected}
        onClick={onEmail}
      />
    </div>
  )
}

function StepCard({
  kind,
  title,
  detail,
  selected,
  onClick,
}: {
  kind: Block
  title: string
  detail: string
  selected: boolean
  onClick: () => void
}) {
  const label = kind === "trigger" ? "Trigger" : "Email"
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg border bg-card px-3 py-2.5 text-left shadow-[0_1px_1px_rgba(0,0,0,0.04)]",
        selected && "ring-2 ring-foreground"
      )}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
            {kind === "trigger" ? <Zap className="size-3" /> : <Mail className="size-3" />}
          </span>
          <span className="truncate text-sm font-medium">{title}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      </span>
      <span className="mt-1 block truncate pl-7 text-xs text-muted-foreground">{detail}</span>
    </button>
  )
}

function Inspector({
  ruleId,
  block,
  fields,
  types,
  documents,
  messageRef,
  onChange,
  onInsert,
  onSaved,
  canDelete,
}: {
  ruleId: string | null
  block: Block
  fields: Fields | null
  types: FollowUpChoice[]
  documents: FollowUpChoice[]
  messageRef: RefObject<HTMLTextAreaElement | null>
  onChange: (fields: Fields) => void
  onInsert: (token: string) => void
  onSaved: () => void
  canDelete: boolean
}) {
  if (!ruleId || !fields) {
    return (
      <aside className="flex w-full shrink-0 flex-col border-t bg-background lg:w-80 lg:min-h-0 lg:border-t-0 lg:border-l">
        <div className="px-4 py-6 text-sm text-muted-foreground">
          Select a step, or add a follow-up.
        </div>
      </aside>
    )
  }

  const saveAction = upsertReminderRuleAction.bind(null, ruleId === "new" ? null : ruleId)

  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t bg-background lg:w-80 lg:border-t-0 lg:border-l">
      <div className="border-b px-4 py-3">
        <p className="text-xs text-muted-foreground">{block === "trigger" ? "Trigger" : "Email"}</p>
        <p className="text-sm font-medium">
          {block === "trigger"
            ? triggerTitle(liveLabel(fields, types, documents), fields.target)
            : "Send email"}
        </p>
      </div>
      <ActionForm
        key={ruleId}
        action={saveAction}
        submitLabel={ruleId === "new" ? "Add follow-up" : "Save"}
        className="px-4 py-4"
        onSuccess={onSaved}
      >
        <section className={cn("grid gap-3 rounded-lg p-2", block === "trigger" && "bg-muted/70")}>
          <p className="text-xs font-medium text-muted-foreground">When</p>
          <div className="grid gap-1.5">
            <Label htmlFor="follow-up-target">Applies to</Label>
            <select
              id="follow-up-target"
              name="target"
              value={fields.target}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
              onChange={(event) => {
                const target = parseFollowUpTarget(event.target.value)
                if (!target) return
                onChange({ ...fields, target })
              }}
            >
              <option value="type">A document type</option>
              <option value="document">One document</option>
              <option value="any">Any document</option>
            </select>
          </div>
          {fields.target === "type" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="follow-up-type">Document type</Label>
              <select
                id="follow-up-type"
                name="document_type_version_id"
                value={fields.typeId}
                required
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                onChange={(event) => onChange({ ...fields, typeId: event.target.value })}
              >
                {types.length === 0 ? <option value="">No document types yet</option> : null}
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="document_type_version_id" value="" />
          )}
          {fields.target === "document" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="follow-up-document">Document</Label>
              <select
                id="follow-up-document"
                name="document_id"
                value={fields.documentId}
                required
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm"
                onChange={(event) => onChange({ ...fields, documentId: event.target.value })}
              >
                {documents.length === 0 ? <option value="">No documents yet</option> : null}
                {documents.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="document_id" value="" />
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="follow-up-days">Days before expiry</Label>
            <Input
              id="follow-up-days"
              name="days_before"
              type="number"
              min={0}
              max={365}
              value={fields.days}
              required
              onChange={(event) => onChange({ ...fields, days: event.target.value })}
            />
          </div>
        </section>
        <section className={cn("grid gap-3 rounded-lg p-2", block === "email" && "bg-muted/70")}>
          <p className="text-xs font-medium text-muted-foreground">Then</p>
          <div className="grid gap-1.5">
            <Label htmlFor="follow-up-subject">Subject</Label>
            <Input
              id="follow-up-subject"
              name="subject"
              value={fields.subject}
              required
              onChange={(event) => onChange({ ...fields, subject: event.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="follow-up-body">Message</Label>
            <Textarea
              ref={messageRef}
              id="follow-up-body"
              name="body_template"
              value={fields.body}
              required
              rows={6}
              onChange={(event) => onChange({ ...fields, body: event.target.value })}
            />
            <div className="flex flex-wrap gap-1.5">
              {placeholders.map((item) => (
                <Button
                  key={item.token}
                  type="button"
                  variant="outline"
                  size="sm"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onInsert(item.token)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
        </section>
      </ActionForm>
      {canDelete && ruleId !== "new" ? (
        <div className="mt-auto border-t px-4 py-3">
          <ActionForm
            action={deleteReminderRuleAction.bind(null, ruleId)}
            submitLabel="Delete follow-up"
            pendingLabel="Deleting..."
            submitVariant="destructive"
            submitSize="sm"
            onSuccess={onSaved}
          />
        </div>
      ) : null}
    </aside>
  )
}

function Runs({ runs }: { runs: FollowUpRun[] }) {
  if (runs.length === 0) {
    return (
      <EmptyState
        className="py-24"
        icon={<Mail className="size-4" />}
        title="No runs yet"
        description="Sent and failed follow-ups show up here."
      />
    )
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {runs.map((run) => (
        <li key={run.id} className="grid gap-1 border-b px-4 py-3 text-sm sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
          <span className="text-muted-foreground">{run.when}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{run.title}</span>
            <span className="block truncate text-muted-foreground">{run.detail}</span>
          </span>
          <Chip tone={run.status === "sent" ? "green" : "red"}>
            {run.status === "sent" ? "Sent" : "Failed"}
          </Chip>
        </li>
      ))}
    </ul>
  )
}
