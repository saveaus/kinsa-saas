import assert from "node:assert/strict"
import { test } from "node:test"

import { courseExpiryOn, isReminderDue } from "@/modules/reminders/matching"

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

test("a course expiry is the completion date plus the renewal", () => {
  const completed = new Date(2026, 0, 15, 12, 0, 0)
  assert.equal(courseExpiryOn(completed.toISOString(), 12), "2027-01-15")
  assert.equal(courseExpiryOn(completed.toISOString(), 0), null)
  assert.equal(courseExpiryOn("not-a-date", 12), null)
})
