import type { Json } from "@/lib/database.types"
import catalogue from "@/modules/training/library/catalogue.json"
import { registrationCourses } from "@/modules/training/library/registration-courses"
import { parseLesson, type LessonContent } from "@/modules/training/lesson"

type CatalogueEntry = {
  code: string
  parent?: string | null
  lesson: LessonContent
}

const entries: CatalogueEntry[] = [
  ...(catalogue as CatalogueEntry[]),
  ...registrationCourses.map((item) => ({
    code: item.code,
    parent: item.parent,
    lesson: item.lesson,
  })),
]

const lessons = new Map(entries.map((entry) => [entry.code, entry.lesson]))

const parents = new Map(
  entries.map((entry) => [
    entry.code,
    entry.parent?.split(",")[0]?.trim() || null,
  ])
)

export function catalogueParentCode(code: string | null | undefined) {
  if (!code) return null
  return parents.get(code) ?? null
}

export function libraryLesson(
  code: string | null | undefined,
  stored: Json | null
): LessonContent | null {
  const parsed = parseLesson(stored)
  if (parsed) return parsed
  if (!code) return null
  return lessons.get(code) ?? null
}

export function libraryStepCount(
  code: string | null | undefined,
  stored: Json | null
) {
  return libraryLesson(code, stored)?.steps.length ?? 0
}
