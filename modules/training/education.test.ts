import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import { registrationCourses } from "@/modules/training/library/registration-courses"

type LessonStep = {
  kind: string
  title?: string
  paragraphs?: string[]
  kicker?: string
  correct_option_id?: string
  options?: Array<{ id: string }>
  questions?: Array<{
    correct_option_id: string
    options: Array<{ id: string }>
  }>
}

type CatalogueCourse = {
  code: string
  kind: string
  lesson: { steps: LessonStep[] }
}

const catalogue = JSON.parse(
  readFileSync(new URL("./library/catalogue.json", import.meta.url), "utf8")
) as CatalogueCourse[]

const auditFraming = /in this part|guarantee an audit outcome|your score is saved on your worker record/i

function learnText(steps: LessonStep[]) {
  return steps
    .filter((step) => step.kind === "learn")
    .flatMap((step) => step.paragraphs ?? [])
    .join("\n")
}

describe("course lessons teach the topic", () => {
  it("teaches every catalogue course before it asks questions", () => {
    const courses = catalogue.filter((item) => item.kind === "course")
    assert.equal(courses.length, 71)
    for (const course of courses) {
      const learn = course.lesson.steps.filter((step) => step.kind === "learn")
      assert.ok(learn.length > 0, course.code)
      assert.equal(course.lesson.steps[0]?.kind, "learn", course.code)
      for (const step of learn) {
        const text = (step.paragraphs ?? []).join(" ")
        assert.ok(text.length > 280, `${course.code} ${step.title}`)
        assert.equal(auditFraming.test(text), false, `${course.code} ${step.title}`)
      }
    }
  })

  it("keeps bites, checkpoints, and hubs as teaching rather than audit checklists", () => {
    for (const item of catalogue) {
      if (item.kind === "course") continue
      const text = learnText(item.lesson.steps)
      assert.ok(text.length > 180, item.code)
      assert.equal(auditFraming.test(text), false, item.code)
      assert.equal(/five-minute refresher is a short recap/i.test(text), false, item.code)
    }
  })

  it("keeps question answers pointed at a real option", () => {
    for (const course of catalogue) {
      for (const step of course.lesson.steps) {
        if (step.kind === "check") {
          assert.ok(
            step.options?.some((option) => option.id === step.correct_option_id),
            `${course.code} ${step.title}`
          )
        }
        if (step.kind === "exam") {
          for (const question of step.questions ?? []) {
            assert.ok(
              question.options.some((option) => option.id === question.correct_option_id)
            )
          }
        }
      }
    }
  })

  it("teaches registration-group courses without an audit outcome line", () => {
    for (const course of registrationCourses) {
      const text = learnText(course.lesson.steps as LessonStep[])
      assert.equal(auditFraming.test(text), false, course.code)
      assert.ok(text.length > 280, course.code)
    }
  })
})
