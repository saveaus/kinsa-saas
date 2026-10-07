import assert from "node:assert/strict"
import { test } from "node:test"

import {
  logOnPerson,
  logPlaceLabel,
  logShown,
  logSlug,
} from "@/modules/logs/standing"

test("a log name becomes a url slug", () => {
  assert.equal(logSlug("Medication errors"), "medication-errors")
  assert.equal(logSlug("  "), "log")
})

test("a hidden built-in log stays hidden", () => {
  assert.equal(
    logShown([{ built_in: "incident", visible: false }], "incident"),
    false
  )
  assert.equal(logShown([], "incident"), true)
})

test("a person log is labelled with that person", () => {
  assert.equal(
    logPlaceLabel({
      scope: "person",
      subject: "participant",
      personName: "Georgia",
    }),
    "Georgia"
  )
  assert.equal(
    logPlaceLabel({
      scope: "global",
      subject: "worker",
      personName: null,
    }),
    "Sidebar, and on every worker"
  )
})

test("a custom log appears on the matching person", () => {
  const shared = {
    visible: true,
    built_in: null,
    scope: "global" as const,
    subject: "participant" as const,
    participant_id: null,
    worker_id: null,
  }
  assert.equal(logOnPerson(shared, { participantId: "p1" }), true)
  assert.equal(logOnPerson(shared, { workerId: "w1" }), false)
  assert.equal(
    logOnPerson(
      { ...shared, scope: "person", participant_id: "p1" },
      { participantId: "p2" }
    ),
    false
  )
  assert.equal(
    logOnPerson({ ...shared, visible: false }, { participantId: "p1" }),
    false
  )
})
