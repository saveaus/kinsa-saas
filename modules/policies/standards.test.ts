import assert from "node:assert/strict"
import { test } from "node:test"

import { standardsForGroups } from "@/lib/ndis-practice-standards"
import { policyStanding } from "@/modules/policies/standing"

function codes(groups: Parameters<typeof standardsForGroups>[0]) {
  return standardsForGroups(groups).map((standard) => standard.code)
}

test("a verification-only provider sees the verification module", () => {
  const selected = codes(["0128"])
  assert.ok(selected.includes("verification.risk"))
  assert.equal(selected.includes("core.risk"), false)
  assert.equal(selected.includes("hi.bowel"), false)
})

test("daily personal activities includes the core module and implementing behaviour support", () => {
  const selected = codes(["0107"])
  assert.ok(selected.includes("core.incidents"))
  assert.ok(selected.includes("ibs.restrictive"))
  assert.equal(selected.includes("hi.bowel"), false)
  assert.equal(selected.includes("verification.risk"), false)
})

test("high intensity adds the high intensity outcomes", () => {
  const selected = codes(["0104"])
  assert.ok(selected.includes("hi.dysphagia"))
  assert.ok(selected.includes("core.mealtime"))
  assert.ok(selected.includes("ibs.reporting"))
})

test("specialist behaviour support does not add the implementing module on its own", () => {
  const selected = codes(["0110"])
  assert.ok(selected.includes("sbs.plans"))
  assert.equal(
    selected.some((code) => code.startsWith("ibs.")),
    false
  )
})

test("specialist disability accommodation on its own skips the core module", () => {
  const selected = codes(["0131"])
  assert.deepEqual(
    selected.filter((code) => code.startsWith("sda.")).length,
    selected.length
  )
  assert.equal(selected.includes("core.governance"), false)
})

test("specialist disability accommodation with another group includes the core module", () => {
  const selected = codes(["0131", "0128"])
  assert.ok(selected.includes("core.governance"))
  assert.ok(selected.includes("sda.tenancy"))
  assert.equal(selected.includes("verification.risk"), false)
})

test("supported independent living includes its module", () => {
  const selected = codes(["0138"])
  assert.ok(selected.includes("sil.module"))
  assert.ok(selected.includes("core.service-agreements"))
})

test("a draft is not current, and only an accepted review date is scored", () => {
  const today = new Date(2026, 9, 2)
  assert.equal(policyStanding("draft", "2026-12-01", today), "draft")
  assert.equal(policyStanding("accepted", "2026-10-02", today), "current")
  assert.equal(policyStanding("accepted", "2026-10-01", today), "overdue")
  assert.equal(policyStanding("accepted", "2026-10-03", today), "current")
})
