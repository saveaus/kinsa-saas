import type { Json } from "@/lib/database.types"

export type QuizOption = { id: string; label: string }
export type QuizQuestion = {
  id: string
  prompt: string
  options: QuizOption[]
  correct_option_id: string
}
export type Quiz = { questions: QuizQuestion[] }

export function parseQuiz(value: Json | null): Quiz | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const questions = (value as { questions?: unknown }).questions
  if (!Array.isArray(questions) || questions.length === 0) return null
  return value as Quiz
}

export function scoreQuiz(quiz: Quiz, answers: Record<string, string>) {
  const total = quiz.questions.length
  const correct = quiz.questions.filter((question) => answers[question.id] === question.correct_option_id)
    .length
  const percent = total === 0 ? 100 : Math.round((correct / total) * 100)
  return { correct, total, percent }
}
