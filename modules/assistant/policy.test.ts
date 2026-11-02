import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { policyDocxBuffer } from "@/modules/assistant/policy-doc"
import {
  applyPolicyFilings,
  parsePolicyDraft,
  policyDraftsFromParts,
  policyFilename,
  policyFilingKey,
  policyRevisionPrompt,
  policyRevisionTarget,
} from "@/modules/assistant/policy"
import { preparePolicyFiling } from "@/modules/assistant/tasks"
import { policyDraftRequested } from "@/modules/assistant/model"
import { policyFlagPrompt } from "@/modules/policies/flag-prompt"

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

const directory = { organisation: "Real Org", standards: [{ code: "core-1", name: "Rights" }] }

describe("preparePolicyFiling", () => {
  it("treats the browser's draft as untrusted", () => {
    const prepared = preparePolicyFiling(
      {
        draft: { ...draft, organisation: "Someone Else", title: `  ${"x".repeat(500)} `, filed: "Done" },
        standardCode: "core-1",
      },
      directory
    )
    assert.ok(prepared.filing)
    if (!prepared.filing) return
    assert.equal(prepared.draft.organisation, "Real Org")
    assert.equal(prepared.draft.title.length, 160)
    assert.equal(prepared.draft.filed, undefined)
    assert.equal(prepared.standardCode, "core-1")
  })

  it("refuses a broken draft or a standard this organisation does not have", () => {
    assert.equal(preparePolicyFiling({ draft: { title: "x" }, standardCode: "core-1" }, directory).filing, false)
    assert.equal(preparePolicyFiling({ draft, standardCode: "other" }, directory).filing, false)
    assert.equal(preparePolicyFiling({ draft }, directory).filing, false)
    assert.equal(preparePolicyFiling(null, directory).filing, false)
  })

  it("a revision needs a real policy id and no standard", () => {
    const id = "6f1d2c3e-1111-4222-8333-444455556666"
    const prepared = preparePolicyFiling({ draft, revisesPolicyId: id }, directory)
    assert.ok(prepared.filing)
    if (prepared.filing) assert.equal(prepared.revisesPolicyId, id)
    assert.equal(preparePolicyFiling({ draft, revisesPolicyId: "' or 1=1" }, directory).filing, false)
  })
})

describe("policyRevisionTarget", () => {
  const id = "6f1d2c3e-1111-4222-8333-444455556666"
  const flag = policyFlagPrompt({ id, name: "Privacy", standardName: "Rights", note: null })

  it("finds the flagged policy once the customer asks to implement the changes", () => {
    const messages = [
      { role: "user", text: flag },
      { role: "assistant", text: "These are the gaps." },
      { role: "user", text: policyRevisionPrompt },
      { role: "assistant", text: "Here is the revised draft." },
    ]
    assert.deepEqual(policyRevisionTarget(messages, 3), { policyId: id, name: "Privacy" })
  })

  it("leaves an ordinary draft as a new policy", () => {
    assert.equal(policyRevisionTarget([{ role: "user", text: flag }, { role: "assistant", text: "Why." }], 1), null)
    assert.equal(policyRevisionTarget([{ role: "user", text: "Draft a policy" }, { role: "assistant", text: "Done" }], 1), null)
    assert.equal(
      policyRevisionTarget([{ role: "user", text: policyRevisionPrompt }, { role: "assistant", text: "Done" }], 1),
      null
    )
  })
})

describe("applyPolicyFilings", () => {
  it("marks the draft in its own message and remembers it", () => {
    const parsed = parsePolicyDraft(draft)
    assert.ok(parsed)
    const key = policyFilingKey("m1", parsed.filename)
    const filed = applyPolicyFilings("m1", [parsed], [], { [key]: "Saved." })
    assert.equal(filed[0]?.filed, "Saved.")
    assert.equal(applyPolicyFilings("m2", [parsed], [], { [key]: "Saved." })[0]?.filed, undefined)
    assert.equal(applyPolicyFilings("m1", [parsed], filed, {})[0]?.filed, "Saved.")
    assert.equal(parsePolicyDraft(filed[0])?.filed, "Saved.")
  })
})

describe("policyDraftRequested", () => {
  it("gives a typed request to file a policy room for the whole policy", () => {
    assert.equal(policyDraftRequested("File the policy on complaints"), true)
    assert.equal(policyDraftRequested("Where is the complaints register?"), false)
  })
})
