import { format, subDays } from "date-fns"

import { today } from "@/lib/today"
import assert from "node:assert/strict"
import { test } from "node:test"

import { computeWorkerCompliance } from "@/modules/documents/compliance"
import { roleApplies } from "@/modules/workforce/roles"

test("a requirement applies when the worker holds one of its roles", () => {
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
    lapsingWindowDays: 30,
  })

  assert.deepEqual(
    result.items.map((item) => item.key),
    ["doc:screen"]
  )
  assert.equal(result.total, 1)
  assert.equal(result.met, 0)
  assert.equal(result.percent, 0)
  assert.equal(result.overall, "noncompliant")
})

test("no required items scores 100 percent and counts as compliant", () => {
  const result = computeWorkerCompliance({
    workerId: "worker-1",
    workerRoles: ["support"],
    types: [],
    documents: [],
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
    lapsingWindowDays: 30,
  })
  assert.equal(result.items[0]?.status, "pending")
  assert.equal(result.met, 0)
  assert.equal(result.percent, 0)
  assert.equal(result.overall, "pending")
})

function screeningStatus(expiresOn: string | null) {
  return computeWorkerCompliance({
    workerId: "w1",
    types: [
      { id: "screen", name: "Worker screening", requires_expiry: true, required: true },
    ],
    documents: [
      {
        worker_id: "w1",
        document_type_version_id: "screen",
        approval_status: "approved",
        expires_on: expiresOn,
      },
    ],
    lapsingWindowDays: 30,
  }).items[0].status
}

test("a credential is still current on the day it expires", () => {
  assert.equal(screeningStatus(format(today(), "yyyy-MM-dd")), "lapsing")
  assert.equal(screeningStatus(format(subDays(today(), 1), "yyyy-MM-dd")), "expired")
})

test("an approved credential that needs an expiry date is not current without one", () => {
  assert.equal(screeningStatus(null), "pending")
})
