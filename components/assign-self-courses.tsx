"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"

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
import { Input } from "@/components/ui/input"
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
  const [query, setQuery] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [state, action, pending] = useActionState(assignCoursesAction, {})
  const needle = query.trim().toLowerCase()
  const shown = courses.filter((course) => course.title.toLowerCase().includes(needle))
  const assignLabel =
    picked.length === 1 ? "Assign 1 course" : picked.length > 1 ? `Assign ${picked.length} courses` : "Assign"

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
              <DialogDescription>Choose courses to add to My courses.</DialogDescription>
            </DialogHeader>
            <form action={action} className="grid gap-3">
              <input type="hidden" name="worker_id" value={workerId} />
              {picked.map((courseId) => (
                <input key={courseId} type="hidden" name="course_id" value={courseId} />
              ))}
              {state.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : null}
              {courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every course is already on your list.</p>
              ) : (
                <>
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search courses"
                    aria-label="Search courses"
                  />
                  <div className="grid max-h-64 gap-1 overflow-y-auto">
                    {shown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No courses match that search.</p>
                    ) : (
                      shown.map((course) => (
                        <label
                          key={course.id}
                          className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={picked.includes(course.id)}
                            onChange={(event) =>
                              setPicked((current) =>
                                event.target.checked
                                  ? [...current, course.id]
                                  : current.filter((id) => id !== course.id)
                              )
                            }
                          />
                          {course.title}
                        </label>
                      ))
                    )}
                  </div>
                </>
              )}
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
