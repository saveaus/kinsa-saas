"use client"

import { useActionState, useCallback, useRef, useState } from "react"
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
import {
  assignCoursesAction,
  type TrainingActionState,
} from "@/modules/training/actions"

export function AssignWorkerCoursesDialog({
  open,
  workerId,
  workerName,
  courses,
  onOpenChange,
  onAssigned,
}: {
  open: boolean
  workerId: string
  workerName: string
  courses: Array<{ id: string; title: string }>
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const router = useRouter()
  const assigned = useRef(onAssigned)
  assigned.current = onAssigned
  const assignForWorker = useCallback(
    async (previous: TrainingActionState, formData: FormData) => {
      const result = await assignCoursesAction(previous, formData)
      if (result.assigned && !result.error) {
        router.refresh()
        assigned.current()
      }
      return result
    },
    [router]
  )
  const [state, formAction, pending] = useActionState(assignForWorker, {})
  const assignLabel =
    picked.length === 1
      ? "Assign 1 course"
      : picked.length > 1
        ? `Assign ${picked.length} courses`
        : "Assign"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign courses</DialogTitle>
          <DialogDescription>
            Choose courses for {workerName}. They show on this profile and in My
            courses.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
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
          />
          <DialogFooter>
            <Button type="submit" disabled={pending || picked.length === 0}>
              {pending ? "Assigning..." : assignLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
