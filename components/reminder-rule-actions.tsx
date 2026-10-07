"use client"

import { useId, useRef, useState } from "react"

import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteReminderRuleAction,
  upsertReminderRuleAction,
  type ReminderActionState,
} from "@/modules/reminders/actions"
import {
  REMINDER_CATEGORIES,
  reminderCategoryLabel,
  type ReminderCategory,
} from "@/modules/reminders/categories"

const placeholders = [
  { label: "Worker name", token: "{{worker_name}}" },
  { label: "Item", token: "{{item_name}}" },
  { label: "Document", token: "{{document_type}}" },
  { label: "Course", token: "{{course_name}}" },
  { label: "Organisation", token: "{{organisation_name}}" },
  { label: "Expiry date", token: "{{expiry_date}}" },
] as const

function RuleFields({
  category = "documents",
  days = 30,
  subject = "",
  body = "",
}: {
  category?: ReminderCategory
  days?: number
  subject?: string
  body?: string
}) {
  const message = useRef<HTMLTextAreaElement>(null)

  function insertPlaceholder(token: string) {
    const field = message.current
    if (!field) return
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? field.value.length
    const before = field.value.slice(0, start)
    const after = field.value.slice(end)
    const lead = before.length > 0 && !/\s$/.test(before) ? " " : ""
    const trail = after.length > 0 && !/^\s/.test(after) ? " " : ""
    const insert = `${lead}${token}${trail}`
    field.value = `${before}${insert}${after}`
    const cursor = start + insert.length
    field.focus()
    field.setSelectionRange(cursor, cursor)
  }

  return (
    <>
      <div className="grid gap-1.5">
        <Label>Category</Label>
        <select
          name="category"
          defaultValue={category}
          required
          className="h-8 rounded-lg border border-input px-2.5 text-sm"
        >
          {REMINDER_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {reminderCategoryLabel(item)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label>Days before expiry</Label>
        <Input
          name="days_before"
          type="number"
          min={0}
          max={365}
          defaultValue={days}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label>Subject</Label>
        <Input name="subject" defaultValue={subject} required />
      </div>
      <div className="grid gap-1.5">
        <Label>Message</Label>
        <Textarea
          ref={message}
          name="body_template"
          defaultValue={body}
          required
          rows={5}
        />
        <div className="grid grid-cols-3 gap-2">
          {placeholders.map((item) => (
            <Button
              key={item.token}
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => insertPlaceholder(item.token)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </>
  )
}

function RuleForm({
  submitLabel,
  saveAction,
  deleteAction,
  category,
  days,
  subject,
  body,
}: {
  submitLabel: string
  saveAction: (
    state: ReminderActionState,
    formData: FormData
  ) => Promise<ReminderActionState>
  deleteAction?: (
    state: ReminderActionState,
    formData: FormData
  ) => Promise<ReminderActionState>
  category?: ReminderCategory
  days?: number
  subject?: string
  body?: string
}) {
  const saveId = useId()
  const deleteId = useId()
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  return (
    <>
      {deleteAction ? (
        <ActionForm
          id={deleteId}
          action={deleteAction}
          submitLabel="Delete"
          hideSubmit
          bare
          className="contents"
          onPendingChange={setDeleting}
        />
      ) : null}
      <ActionForm
        id={saveId}
        action={saveAction}
        submitLabel={submitLabel}
        hideSubmit
        onPendingChange={setSaving}
      >
        <RuleFields
          category={category}
          days={days}
          subject={subject}
          body={body}
        />
      </ActionForm>
      <div className="mt-3 flex items-center justify-between gap-2">
        {deleteAction ? (
          <Button
            type="submit"
            form={deleteId}
            variant="destructive"
            disabled={saving || deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" form={saveId} disabled={saving || deleting}>
          {saving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </>
  )
}

export function AddReminderRuleButton() {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>Add follow-up</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add follow-up</DialogTitle>
        </DialogHeader>
        <RuleForm
          submitLabel="Add follow-up"
          saveAction={upsertReminderRuleAction.bind(null, null)}
        />
      </DialogContent>
    </Dialog>
  )
}

export function EditReminderRuleButton({
  rule,
}: {
  rule: {
    id: string
    category: ReminderCategory
    days: number
    subject: string
    body: string
  }
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reminderCategoryLabel(rule.category)} · {rule.days} days
          </DialogTitle>
        </DialogHeader>
        <RuleForm
          submitLabel="Save follow-up"
          saveAction={upsertReminderRuleAction.bind(null, rule.id)}
          deleteAction={deleteReminderRuleAction.bind(null, rule.id)}
          category={rule.category}
          days={rule.days}
          subject={rule.subject}
          body={rule.body}
        />
      </DialogContent>
    </Dialog>
  )
}
