"use client"

import { useState } from "react"
import { X } from "lucide-react"

import { Input } from "@/components/ui/input"

export function CourseSearchSelect({
  courses,
  picked,
  onPickedChange,
  emptyLabel = "Every course is already assigned.",
}: {
  courses: Array<{ id: string; title: string }>
  picked: string[]
  onPickedChange: (ids: string[]) => void
  emptyLabel?: string
}) {
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const selected = picked.flatMap((id) => {
    const course = courses.find((item) => item.id === id)
    return course ? [course] : []
  })
  const matches =
    needle.length === 0
      ? []
      : courses
          .filter(
            (course) =>
              !picked.includes(course.id) &&
              course.title.toLowerCase().includes(needle)
          )
          .slice(0, 8)

  if (courses.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="grid gap-2">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((course) => (
            <button
              key={course.id}
              type="button"
              className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted px-2 py-1 text-left text-xs"
              onClick={() =>
                onPickedChange(picked.filter((id) => id !== course.id))
              }
            >
              <span className="truncate">{course.title}</span>
              <X className="size-3 shrink-0" />
              <span className="sr-only">Remove {course.title}</span>
            </button>
          ))}
        </div>
      ) : null}
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search courses"
        aria-label="Search courses"
      />
      {needle.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Search for a course, then add it.
        </p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No courses match that search.
        </p>
      ) : (
        <div className="grid overflow-hidden rounded-md border">
          {matches.map((course) => (
            <button
              key={course.id}
              type="button"
              className="px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onPickedChange([...picked, course.id])
                setQuery("")
              }}
            >
              {course.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
