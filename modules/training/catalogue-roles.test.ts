import assert from "node:assert/strict"
import { test } from "node:test"

import { rolesForCatalogue } from "@/modules/training/catalogue-roles"

test("all staff courses apply to every role", () => {
  assert.deepEqual(rolesForCatalogue("RR-01", "All staff", true), [
    "support",
    "complex_care",
    "leader",
    "office",
  ])
})

test("office-based audience is checked before all staff", () => {
  assert.deepEqual(
    rolesForCatalogue("RR-02", "All staff (office-based)", true),
    ["office"]
  )
})

test("optional courses are not required for a role", () => {
  assert.deepEqual(rolesForCatalogue("RR-03", "All staff", false), [])
})

test("complex care codes stay on the complex care role", () => {
  assert.deepEqual(rolesForCatalogue("CC-01", "Support workers", true), [
    "complex_care",
  ])
  assert.deepEqual(rolesForCatalogue("CC-09", "Role-specific", true), [
    "complex_care",
  ])
})

test("registration-group courses map to the workforce that delivers them", () => {
  assert.deepEqual(
    rolesForCatalogue("PS-06", "Early childhood workers and leaders", true),
    ["support", "complex_care", "leader"]
  )
  assert.deepEqual(rolesForCatalogue("PS-07", "SDA leaders and office", true), [
    "leader",
    "office",
  ])
  assert.deepEqual(rolesForCatalogue("PS-08", "Support coordinators", true), [
    "leader",
    "office",
  ])
  assert.deepEqual(
    rolesForCatalogue("PS-09", "Behaviour support practitioners", true),
    ["leader"]
  )
})

test("optional registration-group courses score nobody until a role is chosen", () => {
  assert.deepEqual(
    rolesForCatalogue("PS-06", "Early childhood workers and leaders", false),
    []
  )
})
