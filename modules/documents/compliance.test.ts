import assert from "node:assert/strict"
import { test } from "node:test"
import { addMonths, formatISO } from "date-fns"

import { computeWorkerCompliance } from "@/modules/documents/compliance"
import { courseLapsed } from "@/modules/training/renewal"
import { roleApplies } from "@/modules/workforce/roles"

test("a course applies when the worker holds one of its roles", () => {
  assert.equal(roleApplies(["support", "complex_care"], ["support"]), true)
  assert.equal(roleApplies(["leader"], ["support"]), false)
  assert.equal(roleApplies(["office"], ["office", "leader"]), true)
})

test("a support worker is scored only on support requirements", () => {
  const result = computeWorkerCompliance({
    workerId: "worker-1",
    workerRoles: ["support"],
    types: [
      { id: "screen", name: "Worker screening", requires_expiry: true, required: true, roles: ["support"] },
      { id: "office-doc", name: "Office credential", requires_expiry: false, required: true, roles: ["office"] },
    ],
    documents: [],
    courses: [
      { id: "support-course", title: "Support course", required: true, roles: ["support"], renewal_months: 12 },
      { id: "complex-course", title: "Complex care course", required: true, roles: ["complex_care"], renewal_months: 12 },
    ],
    enrolments: [],
    lapsingWindowDays: 30,
  })

  assert.deepEqual(
    result.items.map((item) => item.key),
    ["doc:screen", "course:support-course"]
  )
  assert.equal(result.total, 2)
  assert.equal(result.met, 0)
  assert.equal(result.percent, 0)
  assert.equal(result.overall, "noncompliant")
})

test("a completed course past its renewal is expired and drops the score", () => {
  const result = computeWorkerCompliance({
    workerId: "worker-1",
    workerRoles: ["support"],
    types: [],
    documents: [],
    courses: [{ id: "support-course", title: "Support course", required: true, roles: ["support"], renewal_months: 12 }],
    enrolments: [
      {
        worker_id: "worker-1",
        course_id: "support-course",
        status: "completed",
        completed_at: "2024-01-01T00:00:00.000Z",
      },
    ],
    lapsingWindowDays: 30,
  })

  assert.equal(result.items[0]?.status, "expired")
  assert.equal(result.met, 0)
  assert.equal(result.percent, 0)
  assert.equal(result.overall, "noncompliant")
  assert.equal(courseLapsed("2024-01-01T00:00:00.000Z", 12, new Date("2026-09-27T00:00:00.000Z")), true)
  assert.equal(courseLapsed("2026-01-01T00:00:00.000Z", 12, new Date("2026-09-27T00:00:00.000Z")), false)
})

test("a renewal inside the window is lapsing and still counts as met", () => {
  const completedAt = formatISO(addMonths(new Date(), -11))
  const result = computeWorkerCompliance({
    workerId: "worker-1",
    workerRoles: ["support"],
    types: [],
    documents: [],
    courses: [{ id: "support-course", title: "Support course", required: true, roles: ["support"], renewal_months: 12 }],
    enrolments: [
      { worker_id: "worker-1", course_id: "support-course", status: "completed", completed_at: completedAt },
    ],
    lapsingWindowDays: 90,
  })

  assert.equal(result.items[0]?.status, "lapsing")
  assert.equal(result.met, 1)
  assert.equal(result.percent, 100)
  assert.equal(result.overall, "lapsing")
})

test("no required items scores 100 percent and counts as compliant", () => {
  const result = computeWorkerCompliance({
    workerId: "worker-1",
    workerRoles: ["support"],
    types: [],
    documents: [],
    courses: [],
    enrolments: [],
    lapsingWindowDays: 30,
  })
  assert.equal(result.total, 0)
  assert.equal(result.met, 0)
  assert.equal(result.percent, 100)
  assert.equal(result.overall, "compliant")
})

test("pending review does not count toward the percent score", () => {
  const result = computeWorkerCompliance({
    workerId: "worker-1",
    workerRoles: ["support"],
    types: [{ id: "screen", name: "Worker screening", requires_expiry: true, required: true, roles: ["support"] }],
    documents: [
      {
        worker_id: "worker-1",
        document_type_version_id: "screen",
        approval_status: "pending",
        expires_on: "2027-01-01",
      },
    ],
    courses: [],
    enrolments: [],
    lapsingWindowDays: 30,
  })
  assert.equal(result.items[0]?.status, "pending")
  assert.equal(result.met, 0)
  assert.equal(result.percent, 0)
  assert.equal(result.overall, "pending")
})
