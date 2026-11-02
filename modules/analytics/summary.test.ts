import assert from "node:assert/strict"
import { test } from "node:test"

import {
  approvalAges,
  auditReadiness,
  expiryHorizon,
  horizonWeekCount,
  type AnalyticsWorker,
} from "@/modules/analytics/summary"
import type { ComplianceItem } from "@/modules/documents/compliance"

const today = new Date(2026, 9, 3)

function item(
  partial: Pick<ComplianceItem, "key" | "label" | "kind" | "status"> & {
    expiresOn?: string | null
  }
): ComplianceItem {
  return { expiresOn: null, ...partial }
}

function worker(
  overall: AnalyticsWorker["overall"],
  items: ComplianceItem[]
): AnalyticsWorker {
  return { overall, items }
}

test("the horizon covers the lapsing window, within four to twelve weeks", () => {
  assert.equal(horizonWeekCount(7), 4)
  assert.equal(horizonWeekCount(30), 5)
  assert.equal(horizonWeekCount(90), 12)
})

test("expiries land in the week they fall due", () => {
  const weeks = expiryHorizon(
    [
      worker("lapsing", [
        item({
          key: "doc:1",
          label: "First aid",
          kind: "document",
          status: "lapsing",
          expiresOn: "2026-10-06",
        }),
        item({
          key: "doc:induction",
          label: "Induction",
          kind: "document",
          status: "met",
          expiresOn: "2026-10-03",
        }),
        item({
          key: "doc:2",
          label: "Old",
          kind: "document",
          status: "expired",
          expiresOn: "2026-10-02",
        }),
        item({
          key: "doc:3",
          label: "Later",
          kind: "document",
          status: "met",
          expiresOn: "2026-12-31",
        }),
      ]),
    ],
    today,
    8
  )

  assert.equal(weeks[0]?.label, "28 Sep")
  assert.equal(weeks[0]?.documents, 1)
  assert.equal(weeks[1]?.documents, 1)
  assert.equal(
    weeks.reduce((sum, week) => sum + week.documents, 0),
    2
  )
})

test("audit readiness is the share of required items that are current", () => {
  assert.deepEqual(auditReadiness([]), { met: 0, total: 0, percent: 0 })
  assert.deepEqual(
    auditReadiness([
      worker("lapsing", [
        item({ key: "a", label: "A", kind: "document", status: "lapsing" }),
        item({ key: "b", label: "B", kind: "document", status: "pending" }),
      ]),
      worker("noncompliant", [
        item({ key: "c", label: "C", kind: "document", status: "met" }),
        item({ key: "d", label: "D", kind: "document", status: "missing" }),
      ]),
    ]),
    { met: 2, total: 4, percent: 50 }
  )
})

test("approval age uses calendar days", () => {
  const ages = approvalAges(
    ["2026-10-03", "2026-10-02", "2026-09-28", "2026-09-01"],
    today
  )
  assert.deepEqual(
    ages.map((age) => age.count),
    [2, 1, 1]
  )
})
