import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { gapLabelsFromSnapshot, promptsForLogin } from "@/modules/assistant/suggestions"

describe("promptsForLogin", () => {
  it("returns three prompts for a login", () => {
    const prompts = promptsForLogin(["First aid", "Worker screening"], 42)
    assert.equal(prompts.length, 3)
    assert.equal(new Set(prompts).size, 3)
  })

  it("keeps the same prompts for the same login", () => {
    const gaps = ["First aid", "Worker screening"]
    assert.deepEqual(promptsForLogin(gaps, 42), promptsForLogin(gaps, 42))
  })

  it("changes the prompts on the next login", () => {
    const gaps = ["First aid", "Worker screening"]
    assert.notDeepEqual(promptsForLogin(gaps, 42), promptsForLogin(gaps, 99))
  })

  it("reads open items from a snapshot", () => {
    const snapshot = [
      "Readiness: 1 of 2.",
      "First open items:",
      "First aid — Missing — No approved file",
      "Screening — Overdue — Expired",
    ].join("\n")
    assert.deepEqual(gapLabelsFromSnapshot(snapshot), ["First aid", "Screening"])
  })
})
