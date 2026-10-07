import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  courseLengthLabel,
  courseTopic,
  learningGroup,
} from "@/modules/training/display"

describe("course catalogue filters", () => {
  it("uses the parent topic for bites, checkpoints, and hubs", () => {
    assert.equal(courseTopic("RR-01", null), "Rights and responsibilities")
    assert.equal(courseTopic("B-01", "SE-11"), "Support environment")
    assert.equal(courseTopic("CP-05", "SE-11"), "Support environment")
    assert.equal(courseTopic("H-01", "GO-02"), "Governance and operations")
    assert.equal(courseTopic("B-01", null), "Bites")
  })

  it("groups audiences, and inherits the parent for short formats", () => {
    assert.equal(learningGroup("All staff"), "All staff")
    assert.equal(learningGroup("Support workers; Leaders"), "Support workers")
    assert.equal(learningGroup("Leaders; Governance"), "Leaders")
    assert.equal(learningGroup("Role-specific: SIL workers and leaders"), "Role-specific")
    assert.equal(learningGroup("As per parent course", "Support workers"), "Support workers")
    assert.equal(
      learningGroup("Workers due for this refresher", "All staff"),
      "All staff"
    )
  })

  it("bands lesson length from the number of parts", () => {
    assert.equal(courseLengthLabel(2), "Short")
    assert.equal(courseLengthLabel(6), "Short")
    assert.equal(courseLengthLabel(7), "Medium")
    assert.equal(courseLengthLabel(16), "Medium")
    assert.equal(courseLengthLabel(17), "Long")
  })
})
