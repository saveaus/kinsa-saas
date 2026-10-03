"use client"

import Link from "next/link"
import { Search } from "lucide-react"
import { useState } from "react"

import { Chip, type ChipTone } from "@/components/chip"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { enrolmentStatusLabel, enrolmentStatusTone, lessonPercent, renewalLabel } from "@/modules/training/display"

export { enrolmentStatusLabel, enrolmentStatusTone, lessonPercent, renewalLabel }

export const courseCoverFallback = "/training/infection-control/cover.svg"

export function CourseCard({
  href,
  title,
  description,
  imageSrc,
  chips = [],
  label,
  progress,
  compact = false,
}: {
  href?: string
  title: string
  description?: string | null
  imageSrc?: string | null
  chips?: Array<{ label: string; tone: ChipTone }>
  label?: string
  progress?: number
  compact?: boolean
}) {
  const card = (
    <Card size={compact ? "sm" : "default"} className="h-full overflow-hidden transition-colors hover:bg-muted/40">
      <img
        src={imageSrc || courseCoverFallback}
        alt=""
        className={compact ? "h-20 w-full object-cover" : "aspect-[16/9] w-full object-cover"}
      />
      <CardHeader>
        {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
        <CardTitle className={compact ? "line-clamp-2" : undefined}>{title}</CardTitle>
        {description ? (
          <CardDescription className={compact ? "line-clamp-2 text-xs" : "line-clamp-3"}>{description}</CardDescription>
        ) : null}
      </CardHeader>
      {progress != null || chips.length > 0 ? (
        <CardContent className={compact ? "grid gap-2" : "grid gap-3"}>
          {progress != null ? (
            <Progress value={progress}>
              <ProgressLabel>Progress</ProgressLabel>
              <ProgressValue>{() => `${progress}%`}</ProgressValue>
            </Progress>
          ) : null}
          {chips.length > 0 ? (
            <div className={compact ? "flex flex-wrap gap-1" : "flex flex-wrap gap-2"}>
              {chips.map((chip) => (
                <Chip key={chip.label} tone={chip.tone}>
                  {chip.label}
                </Chip>
              ))}
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  )

  if (!href) return card
  return (
    <Link href={href} className="block h-full">
      {card}
    </Link>
  )
}

export function CourseCardGrid({
  courses,
}: {
  courses: Array<{
    id: string
    href: string
    title: string
    description: string | null
    imageSrc: string | null
    progress: number
    chips: Array<{ label: string; tone: ChipTone }>
  }>
}) {
  const [search, setSearch] = useState("")
  const needle = search.trim().toLowerCase()
  const shown = courses.filter((course) => {
    if (!needle) return true
    const haystack = [course.title, course.description, ...course.chips.map((chip) => chip.label)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return haystack.includes(needle)
  })

  return (
    <div className="grid gap-4">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          aria-label="Search courses"
          className="pl-8"
        />
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">No courses match.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((course) => (
            <CourseCard
              key={course.id}
              href={course.href}
              title={course.title}
              description={course.description}
              imageSrc={course.imageSrc}
              progress={course.progress}
              chips={course.chips}
            />
          ))}
        </div>
      )}
    </div>
  )
}


