import type { AuditCriterion } from "@/lib/audit-catalogue"
import {
  ratingLabel,
  type AuditRating,
  type AuditRatingSource,
} from "@/modules/internal-audits/rating"

export function interviewWelcome(criterion: AuditCriterion) {
  return [
    `Welcome! Great to have you here, let's get your internal audit underway for ${criterion.module}: ${criterion.category}, ${criterion.name}.`,
    "",
    "Here's how it works:",
    "",
    "1. Answer a series of questions based on your current policies, practices, and documentation. Respond honestly to what's actually in place.",
    "2. Get feedback as we go. I'll flag gaps, risks, or areas where you're doing well.",
    "3. Receive a summary at the end with a rating of Met, Partially met, or Not met. An administrator can change that rating.",
    "",
    "The same criterion is asked differently each time you run an internal audit. Ready to get started?",
  ].join("\n")
}

export function priorQuestionPhrases(messageLists: readonly (readonly string[])[]) {
  const phrases: string[] = []
  for (const texts of messageLists) {
    for (const text of texts) {
      const trimmed = text.trim()
      if (!trimmed || trimmed.startsWith("Welcome!")) continue
      const sentence = trimmed.split(/(?<=\?)/)[0]?.trim() ?? ""
      if (sentence.length < 12) continue
      phrases.push(sentence.slice(0, 180))
      if (phrases.length >= 8) return phrases
    }
  }
  return phrases
}

export function interviewInstructions(input: {
  criterion: AuditCriterion
  policyOnFile: boolean
  priorPhrases: readonly string[]
  recorded: { rating: AuditRating; source: AuditRatingSource } | null
}) {
  const lines = [
    "You are running an internal audit interview for an Australian NDIS provider.",
    `Module: ${input.criterion.module}.`,
    `Category: ${input.criterion.category}.`,
    `Criterion: ${input.criterion.name}.`,
    "Ask about what is actually in place: the policy or procedure, day-to-day practice, who is responsible, and what evidence could be shown.",
    "Ask one question at a time. After each answer, say briefly what sounds solid and what is missing, then ask the next question.",
    "Cover that same ground on every audit, using different words each time. Do not read the criterion name out as the question.",
    "Do not guarantee an external audit outcome.",
    input.policyOnFile
      ? "An accepted policy is on file for this criterion. You may ask how it is used. Do not assume it is followed."
      : "No accepted policy is on file for this criterion. You may ask whether one exists.",
    "When you have enough to rate the criterion, call record_assessment with met, partial, or not_met and a short summary of what you heard. The rating is not saved until they press Confirm. Then tell the person the rating in plain language and what to improve.",
    "met means this is in place. partial means some of it is in place. not_met means it is missing or not working.",
  ]
  if (input.priorPhrases.length > 0) {
    lines.push("Do not reuse these earlier questions:")
    for (const phrase of input.priorPhrases) lines.push(`- ${phrase}`)
  }
  if (input.recorded?.source === "admin") {
    lines.push(
      `An administrator set the rating to ${ratingLabel(input.recorded.rating)}. Do not call record_assessment.`
    )
  } else if (input.recorded) {
    lines.push(
      `A rating is already recorded: ${ratingLabel(input.recorded.rating)}. Call record_assessment only if later answers change it.`
    )
  }
  return lines.join("\n")
}
