import assert from "node:assert/strict"
import test from "node:test"

import { format } from "date-fns"

import { formatDateTime } from "@/lib/format-date"
import { today, todayOn, zonedDate } from "@/lib/today"

test("today is the Australian date, not the UTC one", () => {
  assert.equal(todayOn(new Date("2026-11-02T20:00:00Z")), "2026-11-03")
  assert.equal(todayOn(new Date("2026-07-01T20:00:00Z")), "2026-07-02")
  assert.equal(format(today(new Date("2026-11-02T20:00:00Z")), "yyyy-MM-dd"), "2026-11-03")
})

test("timestamps read in the app time zone", () => {
  const value = new Date("2026-11-02T20:30:00Z")
  assert.equal(format(zonedDate(value), "yyyy-MM-dd HH:mm"), "2026-11-03 07:30")
  assert.equal(formatDateTime("2026-11-02T20:30:00Z"), "3 Nov 2026 · 07:30")
})
