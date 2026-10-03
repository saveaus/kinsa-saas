import assert from "node:assert/strict"
import { test } from "node:test"

import {
  documentStanding,
  documentStandingLabel,
  type DatedParticipantRecord,
} from "@/modules/participants/standing"

const today = new Date(2026, 9, 2)

function record(
  overrides: Partial<DatedParticipantRecord> &
    Pick<DatedParticipantRecord, "kind" | "status">
): DatedParticipantRecord {
  return { endsOn: null, reviewOn: null, ...overrides }
}

test("a participant with no files is missing both", () => {
  assert.equal(documentStanding("service_agreement", [], today), "missing")
  assert.equal(documentStanding("support_plan", [], today), "missing")
})

test("a draft does not count as current", () => {
  const records = [
    record({
      kind: "service_agreement",
      status: "draft",
      endsOn: "2027-10-02",
    }),
  ]
  assert.equal(documentStanding("service_agreement", records, today), "draft")
})

test("an accepted agreement that ends today is current", () => {
  const records = [
    record({
      kind: "service_agreement",
      status: "accepted",
      endsOn: "2026-10-02",
    }),
  ]
  assert.equal(documentStanding("service_agreement", records, today), "current")
})

test("an accepted agreement that has ended is ended", () => {
  const records = [
    record({
      kind: "service_agreement",
      status: "accepted",
      endsOn: "2026-10-01",
    }),
    record({
      kind: "service_agreement",
      status: "draft",
      endsOn: "2027-10-02",
    }),
  ]
  assert.equal(documentStanding("service_agreement", records, today), "overdue")
  assert.equal(
    documentStandingLabel("service_agreement", "overdue"),
    "Ended"
  )
})

test("the later accepted agreement is the one that counts", () => {
  const records = [
    record({
      kind: "service_agreement",
      status: "accepted",
      endsOn: "2026-01-01",
    }),
    record({
      kind: "service_agreement",
      status: "accepted",
      endsOn: "2027-01-01",
    }),
  ]
  assert.equal(documentStanding("service_agreement", records, today), "current")
})

test("a support plan is current until its review date", () => {
  const current = [
    record({
      kind: "support_plan",
      status: "accepted",
      reviewOn: "2026-10-02",
    }),
  ]
  const overdue = [
    record({
      kind: "support_plan",
      status: "accepted",
      reviewOn: "2026-09-01",
    }),
  ]
  assert.equal(documentStanding("support_plan", current, today), "current")
  assert.equal(documentStanding("support_plan", overdue, today), "overdue")
  assert.equal(documentStandingLabel("support_plan", "overdue"), "Review overdue")
})
