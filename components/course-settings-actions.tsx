"use client"

import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RoleCheckboxes } from "@/components/role-checkboxes"
import { updateCourseSettingsAction } from "@/modules/training/actions"

export function CourseSettingsButton({
  courseId,
  title,
  passMark,
  renewalMonths,
  roles,
  roleOptions,
}: {
  courseId: string
  title: string
  passMark: number
  renewalMonths: number | null
  roles: string[]
  roleOptions?: { value: string; label: string }[]
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Edit
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pass mark, renewal, and which teams must complete this course.
          </DialogDescription>
        </DialogHeader>
        <ActionForm
          action={updateCourseSettingsAction.bind(null, courseId)}
          submitLabel="Save"
        >
          <div className="grid gap-1.5">
            <Label htmlFor={`pass-${courseId}`}>Pass mark (%)</Label>
            <Input
              id={`pass-${courseId}`}
              name="pass_mark"
              type="number"
              min={0}
              max={100}
              defaultValue={passMark}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`renewal-${courseId}`}>Renewal (months)</Label>
            <Input
              id={`renewal-${courseId}`}
              name="renewal_months"
              type="number"
              min={1}
              max={60}
              defaultValue={renewalMonths ?? ""}
              placeholder="No renewal"
            />
          </div>
          <RoleCheckboxes selected={roles} options={roleOptions} />
          <p className="text-xs text-muted-foreground">
            Leave every role clear to keep this course optional.
          </p>
        </ActionForm>
      </DialogContent>
    </Dialog>
  )
}
