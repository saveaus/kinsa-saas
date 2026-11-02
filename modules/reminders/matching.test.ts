import assert from "node:assert/strict"
import { test } from "node:test"

import {
  hasRenewal,
  isReminderDue,
} from "@/modules/reminders/matching"

const today = new Date(2026, 9, 3)

test("a follow-up is due from today through the end of its window", () => {
  assert.equal(isReminderDue("2026-10-03", today, 7), true)
  assert.equal(isReminderDue("2026-10-06", today, 7), true)
  assert.equal(isReminderDue("2026-10-10", today, 7), true)
  assert.equal(isReminderDue("2026-10-02", today, 7), false)
  assert.equal(isReminderDue("2026-10-11", today, 7), false)
})

test("a same-day follow-up is only due on the expiry date", () => {
  assert.equal(isReminderDue("2026-10-03", today, 0), true)
  assert.equal(isReminderDue("2026-10-04", today, 0), false)
})

test("a document with a later copy of the same type is already renewed", () => {
  const document = {
    worker_id: "w1",
    document_type_version_id: "t1",
    expires_on: "2026-11-10",
  }
  assert.equal(
    hasRenewal(document, [{ ...document, expires_on: "2027-11-10" }]),
    true
  )
  assert.equal(hasRenewal(document, [document]), false)
  assert.equal(
    hasRenewal(document, [
      { ...document, worker_id: "w2", expires_on: "2027-11-10" },
      { ...document, document_type_version_id: "t2", expires_on: "2027-11-10" },
    ]),
    false
  )
})
