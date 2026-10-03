import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseLesson } from "@/modules/training/lesson"
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
})
