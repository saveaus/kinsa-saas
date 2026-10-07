"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"

import { CourseSearchSelect } from "@/components/course-search-select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { assignCoursesAction } from "@/modules/training/actions"

export function AssignSelfCourses({
  workerId,
  courses,
}: {
  workerId: string
  courses: Array<{ id: string; title: string }>
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setFormKey((key) => key + 1)
          setOpen(true)
        }}
      >
        Assign to me
      </Button>
      <AssignSelfDialog
        key={formKey}
        open={open}
        workerId={workerId}
        courses={courses}
        onOpenChange={setOpen}
        onAssigned={() => {
          setOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}

function AssignSelfDialog({
  open,
  workerId,
  courses,
  onOpenChange,
  onAssigned,
}: {
  open: boolean
  workerId: string
  courses: Array<{ id: string; title: string }>
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [state, action, pending] = useActionState(assignCoursesAction, {})
  const assignLabel =
    picked.length === 1
      ? "Assign 1 course"
      : picked.length > 1
        ? `Assign ${picked.length} courses`
        : "Assign"

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && state.assigned) onAssigned()
        else onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {state.assigned && state.message ? (
          <div className="grid gap-4 pt-2">
            <DialogHeader>
              <DialogTitle>Assigned</DialogTitle>
              <DialogDescription>{state.message}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={onAssigned}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Assign to me</DialogTitle>
              <DialogDescription>
                Choose courses to add to My courses.
              </DialogDescription>
            </DialogHeader>
            <form action={action} className="grid gap-3">
              <input type="hidden" name="worker_id" value={workerId} />
              {picked.map((courseId) => (
                <input
                  key={courseId}
                  type="hidden"
                  name="course_id"
                  value={courseId}
                />
              ))}
              {state.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}
              <CourseSearchSelect
                courses={courses}
                picked={picked}
                onPickedChange={setPicked}
                emptyLabel="Every course is already on your list."
              />
              <DialogFooter>
                <Button type="submit" disabled={pending || picked.length === 0}>
                  {pending ? "Assigning..." : assignLabel}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
