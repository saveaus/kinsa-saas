"use client"

import { Check } from "lucide-react"
import { useActionState, useMemo, useState } from "react"

import { cn } from "cn"

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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { assignCoursesAction } from "@/modules/training/actions"
import {
  courseFamilyOrder,
  courseKindLabel,
  courseLengthLabel,
  courseLengthOrder,
  courseTopic,
  learningGroup,
  learningGroupOrder,
  type CourseLength,
  type LearningGroup,
} from "@/modules/training/display"

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
  parentCode: string | null
  steps: number
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
  const [formKey, setFormKey] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [topic, setTopic] = useState("")
  const [group, setGroup] = useState("")
  const [length, setLength] = useState("")
  const [kind, setKind] = useState("")
  const [requirement, setRequirement] = useState("")
  const selectedCourses = courses.filter((course) => selected.includes(course.id))
  const listed = useMemo(() => listCatalogue(courses), [courses])
  const filtered = listed.filter((course) => {
    if (topic && course.topic !== topic) return false
    if (group && course.group !== group) return false
    if (length && course.length !== length) return false
    if (kind && course.typeLabel !== kind) return false
    if (requirement === "required" && !course.required) return false
    if (requirement === "optional" && course.required) return false
    return true
  })
  const topics = courseFamilyOrder.filter((name) => listed.some((course) => course.topic === name))
  const groups = learningGroupOrder.filter((name) => listed.some((course) => course.group === name))
  const lengths = courseLengthOrder
    .filter((name) => listed.some((course) => course.length === name))
    .map((name) => ({ value: name, label: lengthChoice(name) }))
  const kinds = ["Course", "Bite", "Checkpoint", "Resource hub"].filter((name) =>
    listed.some((course) => course.typeLabel === name)
  )
  const filtersActive = Boolean(topic || group || length || kind || requirement)

  const rows: RecordRow[] = filtered.map((course) => ({
    id: course.id,
    searchText: [course.description, course.code, course.audience, course.parentTitle].filter(Boolean).join(" "),
    cells: {
      course: {
        kind: "link",
        text: course.title,
        href: `/courses/${course.id}`,
        detail: course.description ?? undefined,
      },
      topic: { kind: "chip", text: course.topic, tone: "gray" },
      group: { kind: "text", text: course.group },
      length: { kind: "text", text: partsLabel(course.steps) },
      type: { kind: "chip", text: course.typeLabel, tone: course.kind === "course" ? "blue" : "purple" },
      requirement: {
        kind: "chip",
        text: course.required ? "Required" : "Optional",
        tone: course.required ? "blue" : "gray",
      },
    },
  }))

  return (
    <>
      {notice ? (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-[#E7F6D9] px-3 py-2 text-sm text-[#3C7A28] dark:bg-[#1C3320] dark:text-[#A8D99A]">
          <Check className="mt-0.5 size-4 shrink-0" />
          <p>{notice}</p>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Topic">
        <TopicChip label="All topics" pressed={topic === ""} onClick={() => setTopic("")} />
        {topics.map((name) => (
          <TopicChip key={name} label={name} pressed={topic === name} onClick={() => setTopic(name)} />
        ))}
      </div>
      <RecordTable
        title={topic || "Courses"}
        pageSize={200}
        selectable
        selectedIds={selected}
        onSelectedChange={setSelected}
        actions={
          <Button
            type="button"
            size="sm"
            disabled={selected.length === 0}
            onClick={() => {
              setFormKey((key) => key + 1)
              setAssignOpen(true)
            }}
          >
            {selected.length === 0
              ? "Assign"
              : `Assign ${selected.length} ${selected.length === 1 ? "course" : "courses"}`}
          </Button>
        }
        toolbar={
          <>
            <CatalogueFilter
              label="Who it's for"
              value={group}
              options={groups}
              onChange={setGroup}
            />
            <CatalogueFilter label="Length" value={length} options={lengths} onChange={setLength} />
            <CatalogueFilter label="Type" value={kind} options={kinds} onChange={setKind} />
            <CatalogueFilter
              label="Requirement"
              value={requirement}
              options={[
                { value: "required", label: "Required" },
                { value: "optional", label: "Optional" },
              ]}
              onChange={setRequirement}
            />
            {filtersActive ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setTopic("")
                  setGroup("")
                  setLength("")
                  setKind("")
                  setRequirement("")
                }}
              >
                Clear
              </Button>
            ) : null}
          </>
        }
        columns={[
          { id: "course", label: "Course" },
          { id: "topic", label: "Topic" },
          { id: "group", label: "Who it's for" },
          { id: "length", label: "Length" },
          { id: "type", label: "Type" },
          { id: "requirement", label: "Requirement" },
        ]}
        rows={rows}
        empty="No courses match those filters."
        emptyDescription="Choose another topic, or clear the other filters."
        renderCard={(row, selecting) => {
          const course = listed.find((item) => item.id === row.id)
          if (!course) return null
          return (
            <ModuleCard
              course={course}
              selecting={selecting}
              selected={selected.includes(course.id)}
              onToggle={() => toggleCourse(course.id, setSelected)}
            />
          )
        }}
        renderCardGrid={(visibleRows, selecting) => (
          <ModuleCardGrid
            courses={listed}
            visibleIds={visibleRows.map((row) => row.id)}
            selecting={selecting}
            selected={selected}
            onToggle={(courseId) => toggleCourse(courseId, setSelected)}
          />
        )}
      />
      <AssignDialog
        key={formKey}
        open={assignOpen}
        courses={selectedCourses}
        workers={workers}
        onOpenChange={setAssignOpen}
        onAssigned={(message) => {
          setSelected([])
          setNotice(message)
        }}
      />
    </>
  )
}

function toggleCourse(courseId: string, setSelected: (update: (current: string[]) => string[]) => void) {
  setSelected((current) =>
    current.includes(courseId) ? current.filter((id) => id !== courseId) : [...current, courseId]
  )
}

function SelectBox({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <label className="absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-md bg-background/90 shadow-sm">
      <input type="checkbox" className="size-4" checked={checked} aria-label={label} onChange={onToggle} />
    </label>
  )
}

function ModuleCard({
  course,
  selecting,
  selected,
  onToggle,
}: {
  course: ListedCourse
  selecting: boolean
  selected: boolean
  onToggle: () => void
}) {
  return (
    <div className="relative h-full">
      {selecting ? <SelectBox checked={selected} label={`Select ${course.title}`} onToggle={onToggle} /> : null}
      <CourseCard
        compact
        href={`/courses/${course.id}`}
        title={course.title}
        description={course.description}
        imageSrc={course.cover_image}
        label={course.typeLabel}
        chips={[
          { label: course.group, tone: "gray" },
          { label: partsLabel(course.steps), tone: "gray" },
          ...(course.required ? [{ label: "Required", tone: "blue" as const }] : []),
        ]}
      />
    </div>
  )
}

function ModuleCardGrid({
  courses,
  visibleIds,
  selecting,
  selected,
  onToggle,
}: {
  courses: ListedCourse[]
  visibleIds: string[]
  selecting: boolean
  selected: string[]
  onToggle: (courseId: string) => void
}) {
  const visible = new Set(visibleIds)
  const shown = courses.filter((course) => visible.has(course.id))

  const families = courseFamilyOrder.flatMap((family) => {
    const inFamily = shown.filter((course) => course.topic === family)
    if (inFamily.length === 0) return []
    return [{ family, courses: inFamily }]
  })

  if (families.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No courses match those filters.</p>
  }

  return (
    <div className="grid gap-8">
      {families.map((group) => (
        <section key={group.family} className="grid gap-3">
          <h3 className="text-sm font-medium">{group.family}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.courses.map((course) => (
              <ModuleCard
                key={course.id}
                course={course}
                selecting={selecting}
                selected={selected.includes(course.id)}
                onToggle={() => onToggle(course.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
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
  onAssigned: (message: string) => void
}) {
  const [state, action, pending] = useActionState(assignCoursesAction, {})
  const [workerQuery, setWorkerQuery] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const needle = workerQuery.trim().toLowerCase()
  const shownWorkers = workers.filter((worker) => {
    if (!needle) return true
    return `${worker.firstName} ${worker.lastName}`.toLowerCase().includes(needle)
  })
  const pickedWorkers = workers.filter((worker) => picked.includes(worker.id))
  const assignLabel =
    pickedWorkers.length === 0
      ? "Assign"
      : pickedWorkers.length === 1
        ? `Assign to ${pickedWorkers[0].firstName} ${pickedWorkers[0].lastName}`
        : `Assign to ${pickedWorkers.length} workers`

  function finish(message: string) {
    onAssigned(message)
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && state.assigned && state.message) onAssigned(state.message)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {state.assigned && state.message ? (
          <div className="grid gap-4 pt-2">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#E7F6D9] text-[#3C7A28] dark:bg-[#1C3320] dark:text-[#A8D99A]">
                <Check className="size-4" />
              </span>
              <div className="grid gap-1">
                <DialogTitle>Assigned</DialogTitle>
                <p className="text-sm text-muted-foreground">{state.message}</p>
                <p className="text-sm text-muted-foreground">It shows on their profile and in My courses.</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => finish(state.message ?? "Assigned.")}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Assign courses</DialogTitle>
              <DialogDescription>
                {courses.length === 1 ? courses[0].title : `${courses.length} courses`} will show on each selected
                worker’s profile and in My courses.
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
                      <input
                        type="checkbox"
                        name="worker_id"
                        value={worker.id}
                        className="size-4"
                        checked={picked.includes(worker.id)}
                        onChange={(event) =>
                          setPicked((current) =>
                            event.target.checked
                              ? [...current, worker.id]
                              : current.filter((id) => id !== worker.id)
                          )
                        }
                      />
                      {worker.firstName} {worker.lastName}
                    </label>
                  ))
                )}
              </div>
              <DialogFooter>
                <Button type="submit" disabled={pending || picked.length === 0 || courses.length === 0}>
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

function partsLabel(steps: number) {
  return steps === 1 ? "1 part" : `${steps} parts`
}

function lengthChoice(length: CourseLength) {
  switch (length) {
    case "Short":
      return "Up to 6 parts"
    case "Medium":
      return "7 to 16 parts"
    case "Long":
      return "17 parts or more"
    default: {
      const unreachable: never = length
      return unreachable
    }
  }
}

type ListedCourse = CatalogueCourse & {
  topic: string
  group: LearningGroup
  length: CourseLength
  typeLabel: string
  parentTitle: string | null
}

function familyIndex(topic: string) {
  const index = (courseFamilyOrder as readonly string[]).indexOf(topic)
  return index === -1 ? 99 : index
}

function kindRank(kind: string) {
  if (kind === "course") return 0
  if (kind === "bite") return 1
  if (kind === "checkpoint") return 2
  if (kind === "hub") return 3
  return 4
}

function listCatalogue(courses: CatalogueCourse[]): ListedCourse[] {
  const titleByCode = new Map(courses.flatMap((course) => (course.code ? [[course.code, course.title] as const] : [])))
  const audienceByCode = new Map(
    courses.flatMap((course) => (course.code ? [[course.code, course.audience] as const] : []))
  )
  const listed = courses.map((course) => ({
    ...course,
    topic: courseTopic(course.code, course.parentCode),
    group: learningGroup(
      course.audience,
      course.parentCode ? (audienceByCode.get(course.parentCode) ?? null) : null
    ),
    length: courseLengthLabel(course.steps),
    typeLabel: courseKindLabel(course.kind),
    parentTitle: course.parentCode ? (titleByCode.get(course.parentCode) ?? null) : null,
  }))
  listed.sort((left, right) => {
    const topicDelta = familyIndex(left.topic) - familyIndex(right.topic)
    if (topicDelta !== 0) return topicDelta
    const kindDelta = kindRank(left.kind) - kindRank(right.kind)
    if (kindDelta !== 0) return kindDelta
    return left.title.localeCompare(right.title)
  })
  return listed
}

function TopicChip({
  label,
  pressed,
  onClick,
}: {
  label: string
  pressed: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-md border-0 px-2 py-1 text-xs font-medium shadow-none",
        pressed
          ? "bg-[#E6E8EB] text-foreground dark:bg-[#3A3F46] dark:text-foreground"
          : "bg-[#F1F2F4] text-[#5E6570] hover:bg-[#E6E8EB] dark:bg-[#32363C] dark:text-[#C8CDD4] dark:hover:bg-[#3A3F46]"
      )}
    >
      {label}
    </button>
  )
}

function CatalogueFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<string | { value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <NativeSelect
      size="sm"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <NativeSelectOption value="">{label}</NativeSelectOption>
      {options.map((option) => {
        const item = typeof option === "string" ? { value: option, label: option } : option
        return (
          <NativeSelectOption key={item.value} value={item.value}>
            {item.label}
          </NativeSelectOption>
        )
      })}
    </NativeSelect>
  )
}
