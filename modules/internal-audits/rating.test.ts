import assert from "node:assert/strict"
import { test } from "node:test"

import {
  assignmentStanding,
  nextAssessment,
} from "@/modules/internal-audits/rating"

test("an assistant rating does not replace an administrator rating", () => {
  assert.equal(
    nextAssessment(
      { rating: "met", source: "admin" },
      { rating: "not_met", source: "assistant" }
    ),
    null
  )
})

test("an administrator rating replaces the assistant", () => {
  assert.deepEqual(
    nextAssessment(
      { rating: "partial", source: "assistant" },
      { rating: "met", source: "admin" }
    ),
    { rating: "met", source: "admin" }
  )
})

test("a started interview without a rating is in progress", () => {
  assert.deepEqual(assignmentStanding({ rating: null, started: true }), {
    kind: "progress",
  })
  assert.deepEqual(assignmentStanding({ rating: null, started: false }), {
    kind: "waiting",
  })
  assert.deepEqual(assignmentStanding({ rating: "met", started: true }), {
    kind: "rated",
    rating: "met",
  })
})
