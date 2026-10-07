"use client"

import { cn } from "cn"
import { ChevronDown, ChevronUp } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

import { BackLink } from "@/components/back-link"
import { Button } from "@/components/ui/button"
import { practicalSignOff } from "@/modules/training/display"
import {
  EXAM_ATTEMPTS,
  type PublicLessonStep,
} from "@/modules/training/lesson"
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
  const [examIndex, setExamIndex] = useState(0)
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

  function submitChoice() {
    if (checkReady || index < unlocked) {
      goTo(index + 1)
      return
    }
    if (!choice) {
      setCheckError(
        step?.kind === "situation"
          ? "Choose what you would do."
          : "Choose an answer to continue."
      )
      return
    }
    startTransition(async () => {
      const result = await advanceLessonAction(
        enrolmentId,
        moduleId,
        index,
        choice
      )
      if (result.held) {
        setFeedback(result.feedback ?? null)
        setCheckError(null)
        setCheckReady(false)
        return
      }
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

  function advanceExam() {
    if (step?.kind !== "exam") return
    if (passed) {
      router.push(certificateHref)
      return
    }
    if (locked) return
    const question = step.questions[examIndex]
    if (!question) return
    if (!examAnswers[question.id]) {
      setExamError("Choose an answer to continue.")
      return
    }
    setExamError(null)
    if (examIndex < step.questions.length - 1) {
      setExamIndex((current) => current + 1)
      return
    }
    submitExam()
  }

  function pressOk() {
    if (!step || pending) return
    switch (step.kind) {
      case "learn":
        continueLearn()
        return
      case "check":
      case "situation":
        submitChoice()
        return
      case "exam":
        advanceExam()
        return
      default: {
        const unreachable: never = step
        return unreachable
      }
    }
  }

  function pressUp() {
    if (pending) return
    if (step?.kind === "exam" && examIndex > 0) {
      setExamError(null)
      setExamIndex((current) => current - 1)
      return
    }
    if (index > 0) goTo(index - 1)
  }

  function selectLetter(letterIndex: number) {
    if (!step || pending) return
    switch (step.kind) {
      case "learn":
        return
      case "check": {
        const option = step.options[letterIndex]
        if (!option) return
        setChoice(option.id)
        setCheckError(null)
        setFeedback(null)
        setCheckReady(false)
        return
      }
      case "situation": {
        const option = step.choices[letterIndex]
        if (!option) return
        setChoice(option.id)
        setCheckError(null)
        setFeedback(null)
        setCheckReady(false)
        return
      }
      case "exam": {
        if (passed || locked) return
        const question = step.questions[examIndex]
        const option = question?.options[letterIndex]
        if (!question || !option) return
        setExamAnswers((current) => ({
          ...current,
          [question.id]: option.id,
        }))
        setExamError(null)
        return
      }
      default: {
        const unreachable: never = step
        return unreachable
      }
    }
  }

  const actions = useRef({ pressOk, pressUp, selectLetter })
  actions.current = { pressOk, pressUp, selectLetter }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === "Enter") {
        if (event.target instanceof HTMLButtonElement) return
        event.preventDefault()
        actions.current.pressOk()
        return
      }
      if (event.key === "ArrowUp") {
        event.preventDefault()
        actions.current.pressUp()
        return
      }
      if (event.key === "ArrowDown") {
        event.preventDefault()
        actions.current.pressOk()
        return
      }
      const letter = event.key.toUpperCase()
      if (letter.length !== 1) return
      const letterIndex = letter.charCodeAt(0) - 65
      if (letterIndex < 0 || letterIndex > 25) return
      event.preventDefault()
      actions.current.selectLetter(letterIndex)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  if (!step) return null

  const signOff = index === 0 ? practicalSignOff(courseCode ?? null) : null
  const examQuestion = step.kind === "exam" ? step.questions[examIndex] : null
  const question =
    step.kind === "check" || step.kind === "situation"
      ? step.prompt
      : step.kind === "exam"
        ? (examQuestion?.prompt ?? step.title)
        : step.title
  const number =
    step.kind === "exam" ? examIndex + 1 : index + 1
  const bar =
    step.kind === "exam" && step.questions.length > 0 && !passed
      ? Math.round(
          ((index + examIndex / step.questions.length) / steps.length) * 100
        )
      : progress
  const okLabel = pending
    ? pendingLabel(step.kind)
    : step.kind === "exam" &&
        !passed &&
        examIndex === step.questions.length - 1
      ? "Submit"
      : "OK"
  const upDisabled = pending || (index === 0 && examIndex === 0)
  const screenKey = step.kind === "exam" ? `${step.id}:${examIndex}` : step.id

  return (
    <div className="flex h-svh flex-col bg-background">
      <div
        className="h-1 shrink-0 bg-muted"
        role="progressbar"
        aria-valuenow={bar}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress"
      >
        <div
          className="h-full bg-foreground transition-all"
          style={{ width: `${bar}%` }}
        />
      </div>
      <header className="flex items-center justify-between gap-4 px-5 py-4">
        <BackLink href={`/me/courses/${enrolmentId}`} />
        <p className="truncate text-sm text-muted-foreground">{moduleTitle}</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full items-center">
        <article
          key={screenKey}
          className="mx-auto w-full max-w-xl animate-in px-6 py-8 fade-in slide-in-from-bottom-3 duration-300"
        >
          <h2 className="text-xl leading-8 text-balance">
            <span className="mr-2 text-muted-foreground tabular-nums">
              {number}
            </span>
            <span className="mr-2 text-muted-foreground">→</span>
            {question}
          </h2>
          {step.kind === "learn" ? (
            <div className="mt-4 grid gap-4">
              {signOff ? (
                <p className="text-sm text-muted-foreground">
                  {signOff.note}{" "}
                  <Link
                    href="/me/documents"
                    className="text-primary underline underline-offset-4"
                  >
                    Record the {signOff.name.toLowerCase()} sign-off
                  </Link>
                </p>
              ) : null}
              <img
                src={step.image.src}
                alt={step.image.alt}
                className="max-h-64 w-full rounded-lg object-cover"
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
                <ul className="grid gap-2 text-base leading-7">
                  {step.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {step.kind === "situation" ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {step.scene}
            </p>
          ) : null}
          {step.kind === "exam" ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {examIndex === 0 ? `${step.intro} ` : null}
              {passed
                ? "You have passed."
                : locked
                  ? "You have used all 3 attempts. Restart the course to try again."
                  : `Question ${examIndex + 1} of ${step.questions.length}. Attempt ${attemptsUsed + 1} of ${EXAM_ATTEMPTS}. Pass mark ${passMark}%.`}
            </p>
          ) : null}
          {step.kind === "check" ? (
            <>
              {step.image ? (
                <img
                  src={step.image.src}
                  alt={step.image.alt}
                  className="mt-6 max-h-64 w-full rounded-lg object-cover"
                />
              ) : null}
              <AnswerChoices
                options={step.options}
                selected={choice}
                onSelect={(id) => {
                  setChoice(id)
                  setCheckError(null)
                  setFeedback(null)
                  setCheckReady(false)
                }}
              />
            </>
          ) : null}
          {step.kind === "situation" ? (
            <AnswerChoices
              options={step.choices}
              selected={choice}
              onSelect={(id) => {
                setChoice(id)
                setCheckError(null)
                setFeedback(null)
                setCheckReady(false)
              }}
            />
          ) : null}
          {step.kind === "exam" && examQuestion && !locked ? (
            <AnswerChoices
              options={examQuestion.options}
              selected={examAnswers[examQuestion.id] ?? null}
              disabled={passed}
              onSelect={(id) => {
                setExamAnswers((current) => ({
                  ...current,
                  [examQuestion.id]: id,
                }))
                setExamError(null)
              }}
            />
          ) : null}
          {feedback ? <p className="mt-4 text-sm leading-6">{feedback}</p> : null}
          {checkError ? (
            <p className="mt-4 text-sm text-destructive">{checkError}</p>
          ) : null}
          {examError ? (
            <p className="mt-4 text-sm text-destructive">{examError}</p>
          ) : null}
          {examMessage ? (
            <p className="mt-4 text-sm leading-6">
              {examMessage}{" "}
              {passed ? (
                <Link
                  href={certificateHref}
                  className="underline underline-offset-4"
                >
                  View certificate
                </Link>
              ) : null}
            </p>
          ) : null}
          {step.kind === "exam" && locked ? null : (
            <div className="mt-6 flex items-center gap-3">
              <Button type="button" disabled={pending} onClick={pressOk}>
                {okLabel}
              </Button>
              <span className="text-xs text-muted-foreground">
                press Enter ↵
              </span>
            </div>
          )}
        </article>
        </div>
      </div>
      <div className="flex justify-end px-5 py-4">
        <div className="flex overflow-hidden rounded-md border">
          <button
            type="button"
            aria-label="Previous"
            disabled={upDisabled}
            onClick={pressUp}
            className="flex size-8 items-center justify-center border-r disabled:text-muted-foreground"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={pending || (step.kind === "exam" && locked)}
            onClick={pressOk}
            className="flex size-8 items-center justify-center disabled:text-muted-foreground"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function pendingLabel(kind: PublicLessonStep["kind"]) {
  switch (kind) {
    case "learn":
    case "situation":
      return "Saving..."
    case "check":
      return "Checking..."
    case "exam":
      return "Submitting..."
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function AnswerChoices({
  options,
  selected,
  disabled,
  onSelect,
}: {
  options: Array<{ id: string; label: string }>
  selected: string | null
  disabled?: boolean
  onSelect: (id: string) => void
}) {
  return (
    <div className="mt-6 grid gap-2" role="radiogroup">
      {options.map((option, index) => {
        const letter = String.fromCharCode(65 + index)
        const on = selected === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onSelect(option.id)}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-2 text-left text-base",
              on ? "bg-muted" : "hover:bg-muted/60"
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded border text-xs font-medium",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background"
              )}
            >
              {letter}
            </span>
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
