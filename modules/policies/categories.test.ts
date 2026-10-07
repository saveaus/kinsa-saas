import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"

import { practiceStandardName } from "@/lib/ndis-practice-standards"
import {
  categoryForStandard,
  policySections,
} from "@/modules/policies/categories"

test("policies are filed under the registration group their standard belongs to", () => {
  assert.equal(categoryForStandard("core.risk"), "core")
  assert.equal(categoryForStandard("verification.incidents"), "verification")
  assert.equal(categoryForStandard("hi.dysphagia"), "0104")
  assert.equal(categoryForStandard("sbs.plans"), "0110")
  assert.equal(categoryForStandard("ibs.reporting"), "implementing")
  assert.equal(categoryForStandard("ec.child"), "0118")
  assert.equal(categoryForStandard("sil.module"), "0138")
})

test("a provider sees shared modules and each registration group they hold", () => {
  const highIntensity = policySections(["0104"]).map((section) => section.id)
  assert.deepEqual(highIntensity.slice(0, 3), ["all", "core", "implementing"])
  assert.ok(highIntensity.includes("0104"))
  assert.equal(highIntensity.includes("verification"), false)

  const verification = policySections(["0128"]).map((section) => section.id)
  assert.deepEqual(verification, ["all", "verification", "0128"])
})

test("every template names a real practice standard when one is set", () => {
  const catalogue = JSON.parse(
    readFileSync(new URL("./templates/catalogue.json", import.meta.url), "utf8")
  ) as {
    key: string
    standardCode: string | null
    verificationStandardCode: string | null
  }[]
  const keys = new Set<string>()
  for (const entry of catalogue) {
    assert.equal(keys.has(entry.key), false)
    keys.add(entry.key)
    assert.equal(
      existsSync(
        new URL(`./templates/files/${entry.key}.docx`, import.meta.url)
      ),
      true
    )
    for (const code of [entry.standardCode, entry.verificationStandardCode]) {
      if (!code) continue
      assert.notEqual(practiceStandardName(code), code)
    }
  }
  assert.ok(keys.has("core-06"))
  assert.ok(keys.has("all-01"))
})
