import type { Json } from "@/lib/database.types"
import catalogue from "@/modules/training/library/catalogue.json"
import { parseLesson, type LessonContent } from "@/modules/training/lesson"

type CatalogueEntry = {
  code: string
  lesson: LessonContent
}

const lessons = new Map(
  (catalogue as CatalogueEntry[]).map((entry) => [entry.code, entry.lesson])
)

export function libraryLesson(code: string | null | undefined, stored: Json | null): LessonContent | null {
  const parsed = parseLesson(stored)
  if (parsed) return parsed
  if (!code) return null
  return lessons.get(code) ?? null
}

export function libraryStepCount(code: string | null | undefined, stored: Json | null) {
  return libraryLesson(code, stored)?.steps.length ?? 0
}
