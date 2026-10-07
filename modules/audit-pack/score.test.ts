import assert from "node:assert/strict"
import { test } from "node:test"

import {
  packAreaCounts,
  packGaps,
  packReadiness,
  packStatusCounts,
  scoreAuditPack,
  type AuditPackInput,
  type PackItem,
} from "@/modules/audit-pack/score"

const today = new Date(2026, 9, 4)

function input(partial: Partial<AuditPackInput> = {}): AuditPackInput {
  return {
    registrationGroups: [],
    policies: [],
    incidents: [],
    participants: [],
    workerItems: [],
    lapsingWindowDays: 90,
    today,
    ...partial,
  }
}

test("verification groups are not scored on high intensity or behaviour support", () => {
  const items = scoreAuditPack(input({ registrationGroups: ["0128"] }))
  assert.ok(items.some((item) => item.key === "policy:verification.risk"))
  assert.equal(
    items.some(
      (item) =>
        item.key.startsWith("policy:hi.") ||
        item.key.startsWith("policy:ibs.") ||
        item.key.startsWith("policy:sbs.") ||
        item.key.startsWith("policy:core.")
    ),
    false
  )
})

test("high intensity daily personal activities includes those standards", () => {
  const items = scoreAuditPack(input({ registrationGroups: ["0104"] }))
  assert.ok(items.some((item) => item.key === "policy:hi.dysphagia"))
  assert.ok(items.some((item) => item.key === "policy:core.risk"))
  assert.equal(
    items.some((item) => item.key === "policy:verification.risk"),
    false
  )
})

test("a missing policy, draft, unused policy, and overdue review are not ready", () => {
  const items = scoreAuditPack(
    input({
      registrationGroups: ["0128"],
      policies: [
        {
          id: "draft",
          standardCode: "verification.complaints",
          name: "Complaints",
          status: "draft",
          reviewOn: "2027-01-01",
          acknowledged: false,
        },
        {
          id: "unused",
          standardCode: "verification.risk",
          name: "Risk",
          status: "accepted",
          reviewOn: "2027-01-01",
          acknowledged: false,
        },
        {
          id: "overdue",
          standardCode: "verification.human-resources",
          name: "Human resources",
          status: "accepted",
          reviewOn: "2026-01-01",
          acknowledged: true,
        },
      ],
    })
  )
  const byKey = new Map(items.map((item) => [item.key, item]))
  assert.equal(byKey.get("policy:verification.incidents")?.status, "missing")
  assert.equal(byKey.get("policy:verification.complaints")?.detail, "Draft does not count")
  assert.equal(byKey.get("policy:verification.risk")?.detail, "Not in use")
  assert.equal(byKey.get("policy:verification.human-resources")?.status, "overdue")
  assert.equal(packReadiness(items).percent, 0)
})

test("an accepted policy counts when it is acknowledged or linked to a record", () => {
  const acknowledged = scoreAuditPack(
    input({
      registrationGroups: ["0128"],
      policies: [
        {
          id: "risk",
          standardCode: "verification.risk",
          name: "Risk",
          status: "accepted",
          reviewOn: "2027-06-01",
          acknowledged: true,
        },
      ],
    })
  )
  assert.equal(
    acknowledged.find((item) => item.key === "policy:verification.risk")?.status,
    "met"
  )

  const linked = scoreAuditPack(
    input({
      registrationGroups: ["0128"],
      policies: [
        {
          id: "incidents",
          standardCode: "verification.incidents",
          name: "Incidents",
          status: "accepted",
          reviewOn: "2027-06-01",
          acknowledged: false,
        },
      ],
      incidents: [
        {
          id: "recorded",
          kind: "incident",
          summary: "Recorded fall",
          status: "accepted",
        },
      ],
    })
  )
  assert.equal(
    linked.find((item) => item.key === "policy:verification.incidents")?.status,
    "met"
  )
  assert.equal(
    linked.some((item) => item.key === "incident:recorded"),
    false
  )

  const filed = scoreAuditPack(
    input({
      registrationGroups: ["0128"],
      policies: [
        {
          id: "incidents",
          standardCode: "verification.incidents",
          name: "Incidents",
          status: "accepted",
          reviewOn: "2027-06-01",
          acknowledged: false,
        },
      ],
      logEvidence: [
        {
          id: "file",
          summary: "Fall report",
          area: "incident",
          href: "/logs/falls",
        },
      ],
    })
  )
  assert.equal(
    filed.find((item) => item.key === "policy:verification.incidents")?.status,
    "met"
  )
  assert.equal(filed.find((item) => item.key === "log:file")?.status, "met")
})

test("an unaccepted incident, overdue support plan, and expired clearance are not ready", () => {
  const items = scoreAuditPack(
    input({
      incidents: [
        { id: "draft", kind: "incident", summary: "Unreviewed fall", status: "draft" },
      ],
      participants: [
        {
          id: "p1",
          name: "Amira Hassan",
          active: true,
          records: [
            {
              kind: "support_plan",
              status: "accepted",
              endsOn: null,
              reviewOn: "2026-01-01",
            },
            {
              kind: "service_agreement",
              status: "draft",
              endsOn: "2027-01-01",
              reviewOn: null,
            },
          ],
        },
        {
          id: "inactive",
          name: "Harper Singh",
          active: false,
          records: [],
        },
      ],
      workerItems: [
        {
          workerId: "w1",
          workerName: "Maya Chen",
          href: "/workers/w1",
          item: {
            key: "doc:police",
            label: "Police check",
            kind: "document",
            status: "expired",
            expiresOn: "2026-01-01",
          },
        },
      ],
    })
  )
  assert.equal(items.find((item) => item.key === "incident:draft")?.status, "unaccepted")
  assert.equal(items.find((item) => item.key === "support_plan:p1")?.status, "overdue")
  assert.equal(
    items.find((item) => item.key === "service_agreement:p1")?.status,
    "unaccepted"
  )
  assert.equal(
    items.some((item) => item.key.startsWith("support_plan:inactive")),
    false
  )
  assert.equal(
    items.find((item) => item.key === "worker:w1:doc:police")?.status,
    "overdue"
  )
  assert.ok(packReadiness(items).percent < 100)
})

test("high intensity and behaviour support training is left out of a verification checklist", () => {
  const items = scoreAuditPack(
    input({
      registrationGroups: ["0128"],
      workerItems: [
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "doc:bowel",
            label: "Complex bowel care sign-off",
            kind: "document",
            code: "signoff_bowel",
            status: "missing",
          },
        },
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "course:pbs",
            label: "Positive Behaviour Support in Practice",
            kind: "course",
            code: "PS-01",
            status: "missing",
          },
        },
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "doc:police",
            label: "Police check",
            kind: "document",
            code: "police",
            status: "missing",
          },
        },
      ],
    })
  )
  assert.equal(items.some((item) => item.key === "worker:w1:doc:bowel"), false)
  assert.equal(items.some((item) => item.key === "worker:w1:course:pbs"), false)
  assert.equal(items.some((item) => item.key === "worker:w1:doc:police"), true)
})

test("high intensity training counts when that registration group applies", () => {
  const items = scoreAuditPack(
    input({
      registrationGroups: ["0104"],
      workerItems: [
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "course:bowel",
            label: "Complex Bowel Care",
            kind: "course",
            code: "CC-01",
            status: "missing",
          },
        },
      ],
    })
  )
  assert.equal(items.some((item) => item.key === "worker:w1:course:bowel"), true)
})

test("implementing behaviour support keeps behaviour courses and drops high intensity", () => {
  const items = scoreAuditPack(
    input({
      registrationGroups: ["0107"],
      workerItems: [
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "course:pbs",
            label: "Positive Behaviour Support in Practice",
            kind: "course",
            code: "PS-01",
            status: "missing",
          },
        },
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "course:bowel",
            label: "Complex Bowel Care",
            kind: "course",
            code: "CC-01",
            status: "missing",
          },
        },
      ],
    })
  )
  assert.equal(items.some((item) => item.key === "worker:w1:course:pbs"), true)
  assert.equal(items.some((item) => item.key === "worker:w1:course:bowel"), false)
})

test("core mealtime and medication training still count for a verification provider", () => {
  const items = scoreAuditPack(
    input({
      registrationGroups: ["0128"],
      workerItems: [
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "course:mealtime",
            label: "Supporting Safe Mealtimes",
            kind: "course",
            code: "SE-14",
            status: "missing",
          },
        },
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "doc:medication",
            label: "Medication sign-off",
            kind: "document",
            code: "signoff_medication",
            status: "missing",
          },
        },
      ],
    })
  )
  assert.equal(
    items.some((item) => item.key === "worker:w1:course:mealtime"),
    true
  )
  assert.equal(
    items.some((item) => item.key === "worker:w1:doc:medication"),
    true
  )
})

test("with no registration groups, high intensity training is left out and other documents stay", () => {
  const items = scoreAuditPack(
    input({
      workerItems: [
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "course:bowel",
            label: "Complex Bowel Care",
            kind: "course",
            code: "CC-01",
            status: "missing",
          },
        },
        {
          workerId: "w1",
          workerName: "Jordan Hale",
          href: "/workers/w1",
          item: {
            key: "doc:police",
            label: "Police check",
            kind: "document",
            code: "police",
            status: "missing",
          },
        },
      ],
    })
  )
  assert.equal(items.some((item) => item.key === "worker:w1:course:bowel"), false)
  assert.equal(items.some((item) => item.key === "worker:w1:doc:police"), true)
})

test("open item counts leave out evidence that is already current", () => {
  const items: PackItem[] = [
    {
      key: "policy",
      label: "Risk",
      area: "policy",
      status: "missing",
      detail: "No policy",
      href: "/policies",
    },
    {
      key: "course",
      label: "Fire safety",
      area: "course",
      status: "overdue",
      detail: "Expired",
      href: "/workers/w1",
    },
    {
      key: "current",
      label: "Police check",
      area: "clearance",
      status: "met",
      detail: "Current",
      href: "/workers/w1",
    },
  ]
  assert.deepEqual(
    packStatusCounts(items).map((row) => [row.status, row.count]),
    [
      ["overdue", 1],
      ["missing", 1],
      ["unaccepted", 0],
      ["lapsing", 0],
    ]
  )
  assert.deepEqual(
    packAreaCounts(items).map((row) => [row.area, row.count]),
    [
      ["policy", 1],
      ["course", 1],
    ]
  )
})

test("a lapsing item stays on the daily list and still counts toward the score", () => {
  const items = scoreAuditPack(
    input({
      registrationGroups: ["0128"],
      policies: [
        {
          id: "risk",
          standardCode: "verification.risk",
          name: "Risk",
          status: "accepted",
          reviewOn: "2026-11-01",
          acknowledged: true,
        },
      ],
    })
  )
  const risk = items.find((item) => item.key === "policy:verification.risk")
  assert.equal(risk?.status, "lapsing")
  assert.equal(packGaps(items).some((item) => item.key === "policy:verification.risk"), true)
  const readiness = packReadiness(items)
  assert.equal(readiness.met, 1)
  assert.ok(readiness.total > 1)
})
