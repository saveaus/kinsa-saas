import type { Json } from "@/lib/database.types"

export type LessonOption = { id: string; label: string }

export type LearnStep = {
  id: string
  kind: "learn"
  kicker: string
  title: string
  paragraphs: string[]
  points?: string[]
  image: { src: string; alt: string }
  photos?: Array<{ src: string; alt: string }>
}

export type CheckStep = {
  id: string
  kind: "check"
  kicker: string
  title: string
  prompt: string
  options: LessonOption[]
  correct_option_id: string
  feedback: string
  image?: { src: string; alt: string }
}

export type SituationChoice = {
  id: string
  label: string
  outcome: string
  safe: boolean
}

export type SituationStep = {
  id: string
  kind: "situation"
  kicker: string
  title: string
  scene: string
  prompt: string
  choices: SituationChoice[]
}

export type ExamQuestion = {
  id: string
  prompt: string
  options: LessonOption[]
  correct_option_id: string
}

export type ExamStep = {
  id: string
  kind: "exam"
  kicker: string
  title: string
  intro: string
  questions: ExamQuestion[]
}

export type LessonStep = LearnStep | CheckStep | SituationStep | ExamStep
export type LessonContent = { version: 1; steps: LessonStep[] }

export const EXAM_ATTEMPTS = 3
export const EXAM_SITTING = 15

export type PublicLessonStep =
  | Omit<LearnStep, never>
  | Omit<CheckStep, "correct_option_id">
  | (Omit<SituationStep, "choices"> & {
      choices: Array<Pick<SituationChoice, "id" | "label">>
    })
  | (Omit<ExamStep, "questions"> & {
      questions: Array<Omit<ExamQuestion, "correct_option_id">>
    })

export function parseLesson(value: Json | null): LessonContent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as { version?: unknown; steps?: unknown }
  if (record.version !== 1 || !Array.isArray(record.steps) || record.steps.length === 0) return null
  return value as LessonContent
}

export type LessonOutlineItem = { label: string; start: number }

export function lessonOutline(
  steps: Array<{ kind: string; title: string }>
): LessonOutlineItem[] {
  const sections: LessonOutlineItem[] = []
  steps.forEach((step, index) => {
    if (step.kind === "learn" || step.kind === "situation") {
      sections.push({ label: step.title, start: index })
    }
    if (step.kind === "exam") {
      sections.push({ label: "Check your understanding", start: index })
    }
  })
  if (sections.length === 0) {
    return [{ label: steps[0]?.title ?? "Lesson", start: 0 }]
  }
  if (sections[0].start > 0) {
    sections.unshift({ label: steps[0]?.title ?? "Lesson", start: 0 })
  }
  return sections
}

export function toPublicLesson(lesson: LessonContent): PublicLessonStep[] {
  return lesson.steps.map((step) => {
    switch (step.kind) {
      case "learn":
        return step
      case "check": {
        const { correct_option_id: _correct, ...rest } = step
        return rest
      }
      case "situation":
        return {
          ...step,
          choices: step.choices.map(({ id, label }) => ({ id, label })),
        }
      case "exam":
        return {
          ...step,
          questions: step.questions.map(({ correct_option_id: _correct, ...question }) => question),
        }
      default: {
        const unreachable: never = step
        return unreachable
      }
    }
  })
}

export function resolveSituation(
  step: SituationStep,
  answer: string | undefined
): { advance: true; outcome: string } | { advance: false; outcome?: string; error?: string } {
  const choice = step.choices.find((item) => item.id === answer)
  if (!choice) return { advance: false, error: "Choose what you would do." }
  if (!choice.safe) return { advance: false, outcome: choice.outcome }
  return { advance: true, outcome: choice.outcome }
}

export function stepFeedback(step: LearnStep | CheckStep | SituationStep) {
  switch (step.kind) {
    case "learn":
      return undefined
    case "check":
      return step.feedback
    case "situation":
      return step.choices.find((choice) => choice.safe)?.outcome
    default: {
      const unreachable: never = step
      return unreachable
    }
  }
}

function hashSeed(seed: string) {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function drawExamQuestions(questions: ExamQuestion[], seed: string, sitting = EXAM_SITTING) {
  const copy = [...questions]
  let state = hashSeed(seed) || 1
  for (let index = copy.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const swap = state % (index + 1)
    const current = copy[index]
    copy[index] = copy[swap]
    copy[swap] = current
  }
  return copy.slice(0, Math.min(sitting, copy.length))
}

export function lessonForAttempt(lesson: LessonContent, seed: string): LessonContent {
  return {
    version: 1,
    steps: lesson.steps.map((step) => {
      if (step.kind !== "exam") return step
      return { ...step, questions: drawExamQuestions(step.questions, seed) }
    }),
  }
}

export function scoreExam(step: ExamStep, answers: Record<string, string>) {
  const total = step.questions.length
  const correct = step.questions.filter((question) => answers[question.id] === question.correct_option_id).length
  const percent = total === 0 ? 100 : Math.round((correct / total) * 100)
  return { correct, total, percent }
}

export function examPassed(percent: number, passMark: number) {
  return percent >= passMark
}

/** Failed attempts lock the exam until an administrator resets them. */
export function examLocked(passed: boolean, attemptCount: number, maxAttempts = EXAM_ATTEMPTS) {
  if (passed) return false
  return attemptCount >= maxAttempts
}
