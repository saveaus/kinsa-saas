import assert from "node:assert/strict"
import { test } from "node:test"

import { auditCatalogue, catalogueCodes } from "@/lib/audit-catalogue"
import { standardsForGroups } from "@/lib/ndis-practice-standards"

test("complaints sits in provider governance", () => {
  const core = auditCatalogue(["0107"]).find(
    (auditModule) => auditModule.name === "Core module"
  )
  const governance = core?.categories.find(
    (category) =>
      category.name === "Provider governance and operational management"
  )
  assert.ok(
    governance?.criteria.some((criterion) => criterion.code === "core.complaints")
  )
  const rights = core?.categories.find(
    (category) => category.name === "Rights and responsibilities"
  )
  assert.ok(
    rights?.criteria.some((criterion) => criterion.code === "core.person-centred")
  )
})

test("every applicable standard is listed once", () => {
  const groups = ["0104", "0110", "0118", "0131", "0132", "0138"] as const
  const expected = standardsForGroups(groups).map((standard) => standard.code)
  const listed = catalogueCodes(auditCatalogue(groups))
  assert.deepEqual([...listed].sort(), [...expected].sort())
  assert.equal(new Set(listed).size, listed.length)
})

test("a verification provider sees one verification category", () => {
  const modules = auditCatalogue(["0128"])
  assert.equal(modules.length, 1)
  assert.equal(modules[0]?.name, "Verification module")
  assert.equal(modules[0]?.categories.length, 1)
  assert.equal(modules[0]?.categories[0]?.criteria.length, 4)
  assert.equal(
    modules[0]?.categories[0]?.criteria.some(
      (criterion) => criterion.code === "core.risk"
    ),
    false
  )
})

test("no registration groups means no internal audit catalogue", () => {
  assert.deepEqual(auditCatalogue([]), [])
})
