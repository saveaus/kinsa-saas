import assert from "node:assert/strict"
import { test } from "node:test"

import { EXAM_ATTEMPTS, examLocked, examPassed, scoreExam } from "@/modules/training/lesson"

const exam = {
  id: "exam",
  kind: "exam" as const,
  kicker: "Exam",
  title: "Exam",
  intro: "Answer each question.",
  questions: [
    { id: "q1", prompt: "One", options: [{ id: "a", label: "A" }], correct_option_id: "a" },
    { id: "q2", prompt: "Two", options: [{ id: "b", label: "B" }], correct_option_id: "b" },
    { id: "q3", prompt: "Three", options: [{ id: "c", label: "C" }], correct_option_id: "c" },
    { id: "q4", prompt: "Four", options: [{ id: "d", label: "D" }], correct_option_id: "d" },
    { id: "q5", prompt: "Five", options: [{ id: "e", label: "E" }], correct_option_id: "e" },
  ],
}

test("four of five answers is 80 percent and meets the default pass mark", () => {
  const result = scoreExam(exam, { q1: "a", q2: "b", q3: "c", q4: "d", q5: "wrong" })
  assert.equal(result.percent, 80)
  assert.equal(examPassed(result.percent, 80), true)
})

test("a score under the pass mark does not pass", () => {
  const result = scoreExam(exam, { q1: "a", q2: "b", q3: "c", q4: "wrong", q5: "wrong" })
  assert.equal(result.percent, 60)
  assert.equal(examPassed(result.percent, 80), false)
  assert.equal(examPassed(79, 80), false)
  assert.equal(examPassed(80, 80), true)
})

test("three failed attempts lock the exam until it is reset", () => {
  assert.equal(examLocked(false, EXAM_ATTEMPTS - 1), false)
  assert.equal(examLocked(false, EXAM_ATTEMPTS), true)
  assert.equal(examLocked(false, EXAM_ATTEMPTS + 1), true)
  assert.equal(examLocked(true, EXAM_ATTEMPTS), false)
})
