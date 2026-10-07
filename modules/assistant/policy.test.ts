import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { policyDocxBuffer } from "@/modules/assistant/policy-doc"
import {
  parsePolicyDraft,
  policyDraftsFromParts,
  policyFilename,
} from "@/modules/assistant/policy"

const draft = {
  title: "Complaints management",
  organisation: "Abbacare",
  purpose: "How a complaint is received and closed.",
  scope: "Workers and participants of this organisation.",
  statement: "Every complaint is recorded and answered.",
  responsibilities: ["The director owns the register."],
  procedure: ["Record the complaint the day it arrives.", "Write the outcome to the person."],
}

describe("parsePolicyDraft", () => {
  it("keeps a complete draft and names the Word file", () => {
    const parsed = parsePolicyDraft(draft)
    assert.equal(parsed?.title, "Complaints management")
    assert.equal(parsed?.filename, "complaints-management.docx")
    assert.equal(parsed?.procedure.length, 2)
  })

  it("drops a draft that has no procedure", () => {
    assert.equal(parsePolicyDraft({ ...draft, procedure: ["Only one step."] }), null)
  })

  it("reads a finished tool part", () => {
    const drafts = policyDraftsFromParts([
      { type: "tool-draft_policy", state: "output-available", output: draft },
      { type: "tool-draft_policy", state: "input-available", output: draft },
      { type: "text", text: "Here is the draft." },
    ])
    assert.equal(drafts.length, 1)
  })

  it("slugs an empty title to policy.docx", () => {
    assert.equal(policyFilename("..."), "policy.docx")
  })
})

describe("policy document", () => {
  it("writes a Word file", async () => {
    const parsed = parsePolicyDraft(draft)
    assert.ok(parsed)
    const bytes = await policyDocxBuffer(parsed)
    assert.ok(bytes.byteLength > 1000)
    assert.equal(bytes[0], 0x50)
    assert.equal(bytes[1], 0x4b)
  })
})
