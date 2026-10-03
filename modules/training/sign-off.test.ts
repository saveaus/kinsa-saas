import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { practicalSignOff } from "@/modules/training/display"

describe("practical sign-off", () => {
  it("names each complex care skill", () => {
    assert.equal(practicalSignOff("CC-01")?.name, "Complex bowel care")
    assert.equal(practicalSignOff("CC-08")?.name, "Complex wound")
    assert.equal(practicalSignOff("CC-09")?.name, "Diabetes management")
    assert.equal(practicalSignOff("CC-10"), null)
  })

  it("groups medication courses onto one observation", () => {
    for (const code of ["SE-11", "CP-05", "B-15", "B-24", "B-25"]) {
      assert.equal(practicalSignOff(code)?.name, "Medication")
    }
  })

  it("groups manual handling courses onto one observation", () => {
    for (const code of ["SE-06", "SE-10", "CP-04", "B-17", "B-23"]) {
      assert.equal(practicalSignOff(code)?.name, "Manual handling")
    }
    assert.equal(practicalSignOff("SE-05"), null)
    assert.equal(practicalSignOff("RR-01"), null)
  })
})
