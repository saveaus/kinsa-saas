"use client"

import { useActionState, useState } from "react"

import { CourseCard } from "@/components/course-card"
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
import { RecordTable, type RecordRow } from "@/components/record-table"
import { assignCoursesAction } from "@/modules/training/actions"
import { courseFamily, courseKindLabel, renewalLabel } from "@/modules/training/display"

export type CatalogueWorker = {
  id: string
  firstName: string
  lastName: string
}

export type CatalogueCourse = {
  id: string
  title: string
  description: string | null
  cover_image: string | null
  code: string | null
  status: string
  required: boolean
  pass_mark: number
  renewal_months: number | null
  kind: string
  audience: string | null
}

export function CourseCatalogue({
  courses,
  workers,
}: {
  courses: CatalogueCourse[]
  workers: CatalogueWorker[]
}) {
  const [selected, setSelected] = useState<string[]>([])
  const [assignOpen, setAssignOpen] = useState(false)
  const selectedCourses = courses.filter((course) => selected.includes(course.id))

  const rows: RecordRow[] = courses.map((course) => ({
    id: course.id,
    cells: {
      course: { kind: "link", text: course.title, href: `/courses/${course.id}` },
      code: { kind: "text", text: course.code ?? "—" },
      family: { kind: "chip", text: courseFamily(course.code), tone: "gray" },
      type: { kind: "chip", text: courseKindLabel(course.kind), tone: course.kind === "course" ? "blue" : "purple" },
      audience: { kind: "text", text: course.audience ?? "—" },
      requirement: {
        kind: "chip",
        text: course.required ? "Required" : "Optional",
        tone: course.required ? "blue" : "gray",
      },
      pass: { kind: "text", text: `${course.pass_mark}%` },
      renewal: { kind: "text", text: renewalLabel(course.renewal_months) ?? "—" },
      status: {
        kind: "chip",
        text: course.status,
        tone: course.status === "published" ? "green" : "gray",
      },
    },
  }))

  return (
    <>
      <RecordTable
        title="All courses"
        selectable
        selectedIds={selected}
        onSelectedChange={setSelected}
        actions={
          <Button type="button" size="sm" disabled={selected.length === 0} onClick={() => setAssignOpen(true)}>
            {selected.length === 0
              ? "Assign"
              : `Assign ${selected.length} ${selected.length === 1 ? "course" : "courses"}`}
          </Button>
        }
        columns={[
          { id: "course", label: "Course" },
          { id: "code", label: "Code" },
          { id: "family", label: "Family" },
          { id: "type", label: "Type" },
          { id: "audience", label: "Audience" },
          { id: "requirement", label: "Requirement" },
          { id: "pass", label: "Pass mark" },
          { id: "renewal", label: "Renewal" },
          { id: "status", label: "Status" },
        ]}
        rows={rows}
        empty="No courses match those filters."
        renderCard={(row) => {
          const course = courses.find((item) => item.id === row.id)
          if (!course) return null
          return (
            <div className="relative h-full">
              <label className="absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-md bg-background/90 shadow-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={selected.includes(course.id)}
                  aria-label={`Select ${course.title}`}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(course.id)
                        ? current.filter((id) => id !== course.id)
                        : [...current, course.id]
                    )
                  }
                />
              </label>
              <CourseCard
                compact
                href={`/courses/${course.id}`}
                title={course.title}
                description={course.description}
                imageSrc={course.cover_image}
                chips={[
                  ...(course.code ? [{ label: course.code, tone: "gray" as const }] : []),
                  { label: course.status, tone: course.status === "published" ? "green" as const : "gray" as const },
                  {
                    label: course.required ? "Required" : "Optional",
                    tone: course.required ? "blue" as const : "gray" as const,
                  },
                  { label: `${course.pass_mark}% to pass`, tone: "mint" as const },
                  ...(renewalLabel(course.renewal_months)
                    ? [{ label: renewalLabel(course.renewal_months) as string, tone: "orange" as const }]
                    : []),
                ]}
              />
            </div>
          )
        }}
      />
      <AssignDialog
        open={assignOpen}
        courses={selectedCourses}
        workers={workers}
        onOpenChange={setAssignOpen}
        onAssigned={() => setSelected([])}
      />
    </>
  )
}

function AssignDialog({
  open,
  courses,
  workers,
  onOpenChange,
  onAssigned,
}: {
  open: boolean
  courses: CatalogueCourse[]
  workers: CatalogueWorker[]
  onOpenChange: (open: boolean) => void
  onAssigned: () => void
}) {
  const [state, action, pending] = useActionState(assignCoursesAction, {})
  const [workerQuery, setWorkerQuery] = useState("")
  const needle = workerQuery.trim().toLowerCase()
  const shownWorkers = workers.filter((worker) => {
    if (!needle) return true
    return `${worker.firstName} ${worker.lastName}`.toLowerCase().includes(needle)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && state.message) onAssigned()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign courses</DialogTitle>
          <DialogDescription>
            {courses.length} {courses.length === 1 ? "course" : "courses"} will show on each selected worker’s profile and in My training.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-3">
          {courses.map((course) => (
            <input key={course.id} type="hidden" name="course_id" value={course.id} />
          ))}
          {state.error ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}
          {state.message ? (
            <Alert>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          <Input
            value={workerQuery}
            onChange={(event) => setWorkerQuery(event.target.value)}
            placeholder="Search workers"
            aria-label="Search workers"
          />
          <div className="grid max-h-64 gap-1 overflow-y-auto">
            {workers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a worker before assigning courses.</p>
            ) : shownWorkers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workers match that search.</p>
            ) : (
              shownWorkers.map((worker) => (
                <label key={worker.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-muted">
                  <input type="checkbox" name="worker_id" value={worker.id} className="size-4" />
                  {worker.firstName} {worker.lastName}
                </label>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || workers.length === 0 || courses.length === 0}>
              {pending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
