import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  assignmentRequest,
  assignmentsFromParts,
  prepareComplianceAssignment,
  prepareTaskAssignment,
} from "@/modules/assistant/assignments"
import { toStoredMessages } from "@/modules/assistant/messages"
import type { ComplianceLift } from "@/modules/tasks/lift"

const people = [
  { id: "w2", name: "Sam Lee" },
  { id: "w1", name: "Alex Chen" },
]

const plan: Extract<ComplianceLift, { ok: true }> = {
  ok: true,
  current: 40,
  target: 60,
  reached: 60,
  tasks: [
    { key: "gap-1", title: "Alex Chen · First aid", detail: "Missing. No current file" },
    { key: "gap-2", title: "Privacy policy", detail: "Not accepted. Draft only" },
  ],
}

describe("assignmentRequest", () => {
  it("reads a request to become more compliant", () => {
    assert.deepEqual(
      assignmentRequest("What would I need to do to become 20% more compliant today?"),
      { kind: "compliance", mode: "lift", points: 20 }
    )
  })

  it("reads a readiness target", () => {
    assert.deepEqual(
      assignmentRequest("What do we complete today to get our audit readiness to 50%?"),
      { kind: "compliance", mode: "target", percent: 50 }
    )
    assert.deepEqual(
      assignmentRequest("give me a list of things to complete today to get our audit readiness to 50%"),
      { kind: "compliance", mode: "target", percent: 50 }
    )
  })

  it("reads a request to create a task", () => {
    assert.deepEqual(assignmentRequest("Create a task to call the family"), {
      kind: "task",
      title: "call the family",
      detail: "",
    })
  })

  it("reads a request for a set number of things", () => {
    assert.deepEqual(assignmentRequest("give me 5 crucial things"), {
      kind: "compliance",
      mode: "count",
      count: 5,
    })
    assert.deepEqual(assignmentRequest("What are the five most important things to do?"), {
      kind: "compliance",
      mode: "count",
      count: 5,
    })
  })

  it("leaves an ordinary question alone", () => {
    assert.equal(assignmentRequest("What is still missing?"), null)
  })
})

describe("assignment cards", () => {
  it("asks who a single task goes to", () => {
    const result = prepareTaskAssignment(
      { title: "Call the family", detail: "Confirm tomorrow's visit." },
      { people, youId: "w1" }
    )
    assert.equal(result.proposed, true)
    if (!result.proposed) return
    assert.equal(result.assignment.kind, "task")
    assert.equal(result.assignment.tasks.length, 1)
    assert.equal(result.assignment.people[0]?.id, "w1")
    assert.match(result.assignment.note, /Choose who this goes to|Confirm tomorrow/)
  })

  it("refuses a task when there is nobody to assign", () => {
    const result = prepareTaskAssignment({ title: "Call the family" }, { people: [], youId: null })
    assert.equal(result.proposed, false)
  })

  it("builds the compliance card from the open items", () => {
    const result = prepareComplianceAssignment(plan, { people, youId: "w1" })
    assert.equal(result.proposed, true)
    if (!result.proposed) return
    assert.equal(result.assignment.heading, "Raise compliance to 60%")
    assert.match(result.assignment.note, /40%/)
    assert.equal(result.assignment.tasks.length, 2)
  })

  it("remembers who the card was assigned to", () => {
    const prepared = prepareComplianceAssignment(plan, { people, youId: "w1" })
    assert.equal(prepared.proposed, true)
    if (!prepared.proposed) return
    const stored = toStoredMessages(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "text", text: "Assign these to close the gap." },
            {
              type: "tool-assign_tasks",
              state: "output-available",
              toolCallId: "call-1",
              input: { kind: "compliance", lift: 20 },
              output: prepared,
            },
          ],
        },
      ],
      [],
      {},
      {
        assignments: {
          "call-1": { status: "done", result: "2 tasks assigned." },
        },
      }
    )
    assert.equal(stored[0]?.assignments?.[0]?.status, "done")
    assert.equal(stored[0]?.assignments?.[0]?.tasks.length, 2)
    const again = toStoredMessages(
      [{ id: "a1", role: "assistant", parts: [{ type: "text", text: "Assign these to close the gap." }] }],
      stored
    )
    assert.equal(again[0]?.assignments?.[0]?.result, "2 tasks assigned.")
    assert.equal(assignmentsFromParts([]).length, 0)
  })
})
