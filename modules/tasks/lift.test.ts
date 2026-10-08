import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { PackItem, PackStatus } from "@/modules/audit-pack/score"
import { complianceLift, complianceTop } from "@/modules/tasks/lift"

function item(key: string, status: PackStatus): PackItem {
  return {
    key,
    label: key,
    area: "clearance",
    status,
    detail: "No current file",
    href: "/workers/1",
  }
}

describe("complianceLift", () => {
  it("picks the open items that raise the score by the asked points", () => {
    const items = [
      item("a", "met"),
      item("b", "met"),
      item("c", "met"),
      item("d", "met"),
      ...["e", "f", "g", "h", "i", "j"].map((key) => item(key, "missing")),
    ]
    const plan = complianceLift(items, 20)
    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.current, 40)
    assert.equal(plan.target, 60)
    assert.equal(plan.reached, 60)
    assert.deepEqual(
      plan.tasks.map((task) => task.key),
      ["e", "f"]
    )
    assert.match(plan.tasks[0]?.detail ?? "", /Missing/)
  })

  it("does not treat a lapsing item as a way to raise the score", () => {
    const items = [
      item("current", "met"),
      item("soon", "lapsing"),
      item("gap", "overdue"),
      item("other", "missing"),
    ]
    const plan = complianceLift(items, 50)
    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.current, 50)
    assert.deepEqual(
      plan.tasks.map((task) => task.key),
      ["gap", "other"]
    )
  })

  it("says when the score is already there", () => {
    const plan = complianceLift([item("a", "met"), item("b", "met")], 20)
    assert.equal(plan.ok, false)
    if (plan.ok) return
    assert.match(plan.reason, /already 100%/)
  })

  it("stops at the number of things asked for", () => {
    const items = [
      item("a", "met"),
      ...["b", "c", "d", "e", "f", "g", "h"].map((key) => item(key, "missing")),
    ]
    const plan = complianceTop(items, 5)
    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.tasks.length, 5)
    assert.deepEqual(
      plan.tasks.map((task) => task.key),
      ["b", "c", "d", "e", "f"]
    )
    const reloaded = complianceLift(items, plan.target - plan.current)
    assert.equal(reloaded.ok, true)
    if (!reloaded.ok) return
    assert.ok(reloaded.tasks.length >= 5)
    assert.equal(reloaded.tasks[4]?.key, "f")
  })

  it("returns the open items when they cannot reach the full lift", () => {
    const items = [item("a", "met"), item("b", "missing"), item("c", "met")]
    const plan = complianceLift(items, 50)
    assert.equal(plan.ok, true)
    if (!plan.ok) return
    assert.equal(plan.current, 67)
    assert.equal(plan.tasks.length, 1)
    assert.equal(plan.reached, 100)
  })
})
