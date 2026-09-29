"use client"

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
import { deleteReminderRuleAction, upsertReminderRuleAction } from "@/modules/reminders/actions"
import {
  REMINDER_CATEGORIES,
  reminderCategoryLabel,
  type ReminderCategory,
} from "@/modules/reminders/categories"

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
        <Input name="days_before" type="number" min={0} max={365} defaultValue={days} required />
      </div>
      <div className="grid gap-1.5">
        <Label>Subject</Label>
        <Input name="subject" defaultValue={subject} required />
      </div>
      <div className="grid gap-1.5">
        <Label>Message</Label>
        <Textarea name="body_template" defaultValue={body} required rows={5} />
        <p className="text-xs text-muted-foreground">
          Placeholders: {"{{worker_name}}"}, {"{{item_name}}"}, {"{{document_type}}"}, {"{{course_name}}"},{" "}
          {"{{organisation_name}}"}, {"{{expiry_date}}"}. The same category can have several follow-ups, each with its
          own wording.
        </p>
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
        <ActionForm action={upsertReminderRuleAction.bind(null, null)} submitLabel="Add follow-up">
          <RuleFields />
        </ActionForm>
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
      <DialogTrigger render={<Button size="sm" variant="outline" />}>Edit</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reminderCategoryLabel(rule.category)} · {rule.days} days
          </DialogTitle>
        </DialogHeader>
        <ActionForm action={upsertReminderRuleAction.bind(null, rule.id)} submitLabel="Save follow-up">
          <RuleFields category={rule.category} days={rule.days} subject={rule.subject} body={rule.body} />
        </ActionForm>
        <ActionForm action={deleteReminderRuleAction.bind(null, rule.id)} submitLabel="Remove follow-up" />
      </DialogContent>
    </Dialog>
  )
}
