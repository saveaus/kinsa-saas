import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseLesson, resolveSituation, toPublicLesson } from "@/modules/training/lesson"
import { registrationCourses } from "@/modules/training/library/registration-courses"

describe("registration-group courses", () => {
  it("adds the five missing courses once each", () => {
    const codes = registrationCourses.map((course) => course.code)
    assert.deepEqual(codes, ["CC-09", "PS-06", "PS-07", "PS-08", "PS-09"])
  })

  it("requires diabetes for complex care and leaves the others optional", () => {
    const required = Object.fromEntries(
      registrationCourses.map((course) => [course.code, course.required])
    )
    assert.deepEqual(required, {
      "CC-09": true,
      "PS-06": false,
      "PS-07": false,
      "PS-08": false,
      "PS-09": false,
    })
  })

  it("gives every course a lesson a worker can sit", () => {
    for (const course of registrationCourses) {
      const lesson = parseLesson(course.lesson)
      assert.ok(lesson, course.code)
      const exam = lesson.steps.find((step) => step.kind === "exam")
      assert.equal(exam?.kind, "exam")
      if (exam?.kind !== "exam") continue
      assert.ok(exam.questions.length >= 8)
      for (const step of lesson.steps) {
        if (step.kind === "check") {
          assert.ok(
            step.options.some((option) => option.id === step.correct_option_id)
          )
        }
        if (step.kind === "exam") {
          for (const question of step.questions) {
            assert.ok(
              question.options.some(
                (option) => option.id === question.correct_option_id
              )
            )
          }
        }
      }
    }
  })

  it("shows what a decision leads to, and hides that until the worker chooses", () => {
    for (const course of registrationCourses) {
      const lesson = parseLesson(course.lesson)
      assert.ok(lesson, course.code)
      const situations = lesson.steps.filter((step) => step.kind === "situation")
      assert.equal(situations.length, 3, course.code)
      const published = toPublicLesson(lesson)
      for (const step of situations) {
        if (step.kind !== "situation") continue
        const safe = step.choices.filter((choice) => choice.safe)
        assert.equal(safe.length, 1, step.id)
        for (const choice of step.choices) {
          assert.ok(choice.outcome.length > 40, step.id)
        }
        const unsafe = step.choices.find((choice) => !choice.safe)
        assert.ok(unsafe)
        const held = resolveSituation(step, unsafe.id)
        assert.equal(held.advance, false)
        if (!held.advance) assert.equal(held.outcome, unsafe.outcome)
        const moved = resolveSituation(step, safe[0].id)
        assert.equal(moved.advance, true)
        const hidden = published.find((item) => item.id === step.id)
        assert.equal(hidden?.kind, "situation")
        if (hidden?.kind !== "situation") continue
        for (const choice of hidden.choices) {
          assert.equal("outcome" in choice, false)
          assert.equal("safe" in choice, false)
        }
      }
    }
  })
})
