"use client"

import { X } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button, buttonVariants } from "@/components/ui/button"
import { practicalSignOff } from "@/modules/training/display"
import { EXAM_ATTEMPTS, type PublicLessonStep } from "@/modules/training/lesson"
import {
  advanceLessonAction,
  submitExamAction,
} from "@/modules/training/actions"

export function LessonPlayer({
  enrolmentId,
  moduleId,
  moduleTitle,
  steps,
  initialStep,
  passMark,
  priorScore,
  passed,
  attemptsUsed,
  courseCode,
}: {
  enrolmentId: string
  moduleId: string
  moduleTitle: string
  steps: PublicLessonStep[]
  initialStep: number
  passMark: number
  priorScore: number | null
  passed: boolean
  attemptsUsed: number
  courseCode?: string | null
}) {
  const [index, setIndex] = useState(Math.min(initialStep, steps.length - 1))
  const [unlocked, setUnlocked] = useState(
    Math.min(initialStep, steps.length - 1)
  )
  const [choice, setChoice] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [checkReady, setCheckReady] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({})
  const [draftReady, setDraftReady] = useState(false)
  const draftKey = `kinsa-exam:${enrolmentId}:${moduleId}:${attemptsUsed}`
  const [examMessage, setExamMessage] = useState<string | null>(
    passed && priorScore != null ? `Passed with ${priorScore}%.` : null
  )
  const [examError, setExamError] = useState<string | null>(null)
  const locked = !passed && attemptsUsed >= EXAM_ATTEMPTS
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const certificateHref = `/me/courses/${enrolmentId}/certificate`

  const step = steps[index]
  const progress =
    passed || steps.length === 0
      ? passed
        ? 100
        : 0
      : Math.round((index / steps.length) * 100)

  function goTo(next: number) {
    setChoice(null)
    setFeedback(null)
    setCheckError(null)
    setCheckReady(false)
    setIndex(next)
  }

  useEffect(() => {
    if (passed) {
      localStorage.removeItem(draftKey)
      setDraftReady(true)
      return
    }
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const parsed = JSON.parse(raw) as unknown
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setExamAnswers(parsed as Record<string, string>)
        }
      }
    } catch {
      // A damaged draft is ignored. The exam can still be sat.
    }
    setDraftReady(true)
  }, [draftKey, passed])

  useEffect(() => {
    if (!draftReady || passed) return
    if (Object.keys(examAnswers).length === 0) {
      localStorage.removeItem(draftKey)
      return
    }
    localStorage.setItem(draftKey, JSON.stringify(examAnswers))
  }, [draftKey, draftReady, examAnswers, passed])

  function continueLearn() {
    if (index < unlocked) {
      goTo(index + 1)
      return
    }
    startTransition(async () => {
      const result = await advanceLessonAction(enrolmentId, moduleId, index)
      if (result.error) {
        setCheckError(result.error)
        return
      }
      const next = result.stepIndex ?? index + 1
      setUnlocked(next)
      if (next >= steps.length && !steps.some((item) => item.kind === "exam")) {
        router.push(certificateHref)
        return
      }
      goTo(next)
    })
  }

  function submitCheck() {
    if (checkReady || index < unlocked) {
      goTo(index + 1)
      return
    }
    if (!choice) {
      setCheckError("Choose an answer to continue.")
      return
    }
    startTransition(async () => {
      const result = await advanceLessonAction(
        enrolmentId,
        moduleId,
        index,
        choice
      )
      if (result.error) {
        setCheckError(result.error)
        setFeedback(result.feedback ?? null)
        return
      }
      setFeedback(result.feedback ?? null)
      setCheckError(null)
      const next = result.stepIndex ?? index + 1
      setUnlocked(next)
      setCheckReady(true)
    })
  }

  function lessonActionLabel(
    kind: PublicLessonStep["kind"],
    state: {
      pending: boolean
      passed: boolean
      lastStep: boolean
      checkReady: boolean
    }
  ) {
    switch (kind) {
      case "learn":
        if (state.pending) return "Saving..."
        return state.lastStep ? "Finish" : "Continue"
      case "check":
        if (state.pending) return "Checking..."
        return state.checkReady ? "Continue" : "Check answer"
      case "exam":
        if (state.passed) return "Passed"
        return state.pending ? "Submitting..." : "Submit exam"
      default: {
        const unreachable: never = kind
        return unreachable
      }
    }
  }

  function submitExam() {
    const exam = step?.kind === "exam" ? step : null
    if (!exam) return
    if (exam.questions.some((question) => !examAnswers[question.id])) {
      setExamError("Answer every question before you submit.")
      return
    }
    startTransition(async () => {
      const result = await submitExamAction(enrolmentId, moduleId, examAnswers)
      if (result.error) {
        setExamError(result.error)
        setExamMessage(null)
        return
      }
      setExamError(null)
      setExamMessage(result.message ?? "Exam submitted.")
      localStorage.removeItem(draftKey)
      if (result.message?.includes("certificate")) {
        router.push(certificateHref)
      }
    })
  }

  if (!step) return null

  const sections = lessonSections(steps)
  const section = sectionAt(sections, index)
  const signOff = index === 0 ? practicalSignOff(courseCode ?? null) : null
  const nextLabel = lessonActionLabel(step.kind, {
    pending,
    passed,
    lastStep: index === steps.length - 1,
    checkReady,
  })

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4">
        <Link
          href="/me/courses"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <X />
          Exit
        </Link>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {moduleTitle}
        </p>
        <p className="max-w-48 truncate text-sm text-muted-foreground">
          {section.label}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">
          {index + 1} of {steps.length}
          <span className="px-1.5">·</span>
          {progress}%
        </p>
      </header>
      <div
        className="h-1 shrink-0 bg-muted"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress"
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      {sections.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b px-4 py-2">
          {sections.map((item) => {
            const reached = item.start <= unlocked
            const current = item.start === section.start
            return (
              <button
                key={`${item.start}-${item.label}`}
                type="button"
                disabled={!reached || pending}
                onClick={() => goTo(item.start)}
                className={`shrink-0 rounded-md px-2 py-1 text-xs ${
                  current
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground"
                } disabled:opacity-40`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        <article
          key={step.id}
          className="mx-auto grid w-full max-w-3xl gap-6 px-6 py-10"
        >
          <div className="grid gap-1">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              {step.kicker}
            </p>
            <h2 className="font-heading text-2xl">{step.title}</h2>
          </div>

          {signOff ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {signOff.note}{" "}
              <Link
                href="/me/documents"
                className="text-foreground underline underline-offset-4"
              >
                Record the {signOff.name.toLowerCase()} sign-off
              </Link>
            </p>
          ) : null}

          {step.kind === "learn" ? (
            <>
              <img
                src={step.image.src}
                alt={step.image.alt}
                className="w-full rounded-lg"
              />
              {step.photos && step.photos.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {step.photos.map((photo) => (
                    <img
                      key={photo.src}
                      src={photo.src}
                      alt={photo.alt}
                      className="aspect-[4/3] w-full rounded-lg object-cover"
                    />
                  ))}
                </div>
              ) : null}
              <div className="grid gap-4 text-base leading-7">
                {step.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              {step.points ? (
                <ul className="grid gap-2 text-base">
                  {step.points.map((point) => (
                    <li key={point} className="rounded-lg bg-muted px-3 py-2">
                      {point}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}

          {step.kind === "check" ? (
            <>
              {step.image ? (
                <img
                  src={step.image.src}
                  alt={step.image.alt}
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
              ) : null}
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-base leading-7">
                  {step.prompt}
                </legend>
                {step.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
                  >
                    <input
                      type="radio"
                      name={step.id}
                      value={option.id}
                      checked={choice === option.id}
                      onChange={() => {
                        setChoice(option.id)
                        setCheckError(null)
                        setFeedback(null)
                      }}
                      className="mt-1"
                    />
                    {option.label}
                  </label>
                ))}
              </fieldset>
            </>
          ) : null}

          {step.kind === "exam" ? (
            <>
              <p className="text-base leading-7 text-muted-foreground">
                {step.intro}
              </p>
              <p className="text-sm text-muted-foreground">
                {passed
                  ? "You have passed this exam."
                  : locked
                    ? "You have used all 3 attempts. An administrator can reset them from the course page."
                    : `Attempt ${attemptsUsed + 1} of ${EXAM_ATTEMPTS}. Questions are drawn in a new order each attempt.`}
              </p>
              {step.questions.map((question, questionIndex) => (
                <fieldset key={question.id} className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium">
                    {questionIndex + 1}. {question.prompt}
                  </legend>
                  {question.options.map((option) => (
                    <label
                      key={option.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-primary/5"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={examAnswers[question.id] === option.id}
                        disabled={passed || locked}
                        onChange={() =>
                          setExamAnswers((current) => ({
                            ...current,
                            [question.id]: option.id,
                          }))
                        }
                        className="mt-1"
                      />
                      {option.label}
                    </label>
                  ))}
                </fieldset>
              ))}
            </>
          ) : null}

          {checkError ? (
            <Alert variant="destructive">
              <AlertDescription>{checkError}</AlertDescription>
            </Alert>
          ) : null}
          {feedback ? (
            <Alert>
              <AlertDescription>{feedback}</AlertDescription>
            </Alert>
          ) : null}
          {examError ? (
            <Alert variant="destructive">
              <AlertDescription>{examError}</AlertDescription>
            </Alert>
          ) : null}
          {examMessage ? (
            <Alert>
              <AlertDescription>
                {examMessage}{" "}
                {passed ? (
                  <Link
                    href={certificateHref}
                    className="underline underline-offset-4"
                  >
                    View certificate
                  </Link>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </article>
      </div>

      <footer className="shrink-0 border-t bg-background px-4 py-3">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={index === 0 || pending}
            onClick={() => goTo(index - 1)}
          >
            Back
          </Button>
          {step.kind === "learn" ? (
            <Button type="button" disabled={pending} onClick={continueLearn}>
              {nextLabel}
            </Button>
          ) : null}
          {step.kind === "check" ? (
            <Button type="button" disabled={pending} onClick={submitCheck}>
              {nextLabel}
            </Button>
          ) : null}
          {step.kind === "exam" ? (
            <Button
              type="button"
              disabled={pending || passed || locked}
              onClick={submitExam}
            >
              {nextLabel}
            </Button>
          ) : null}
        </div>
      </footer>
    </div>
  )
}

function lessonSections(steps: PublicLessonStep[]) {
  const sections: { label: string; start: number }[] = []
  steps.forEach((step, index) => {
    if (step.kind === "learn")
      sections.push({ label: step.title, start: index })
    if (step.kind === "exam") sections.push({ label: "Exam", start: index })
  })
  if (sections.length === 0)
    return [{ label: steps[0]?.title ?? "Lesson", start: 0 }]
  if (sections[0].start > 0)
    sections.unshift({ label: steps[0]?.title ?? "Lesson", start: 0 })
  return sections
}

function sectionAt(
  sections: { label: string; start: number }[],
  index: number
) {
  let current = sections[0]
  for (const section of sections) {
    if (section.start <= index) current = section
  }
  return current
}
