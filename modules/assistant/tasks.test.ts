import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { toStoredMessages } from "@/modules/assistant/messages"
import {
  authoriseAssistantTask,
  policyRecordBody,
  prepareAssistantTask,
  tasksFromParts,
} from "@/modules/assistant/tasks"

const directory = {
  organisation: "Abbacare",
  teams: [{ code: "support", name: "Support" }],
  standards: [{ code: "core.privacy", name: "Privacy and dignity" }],
  allowed: ["review_documents", "add_worker", "file_policy"] as const,
}

const policy = {
  kind: "file_policy" as const,
  standardCode: "core.privacy",
  title: "Privacy and dignity",
  purpose: "How personal information is kept.",
  scope: "Workers and participants.",
  statement: "Personal information is collected only for support.",
  responsibilities: ["The director owns the register."],
  procedure: ["Record a request the day it arrives.", "Close the request in writing."],
}

describe("prepareAssistantTask", () => {
  it("proposes a document check without checking anything", () => {
    const result = prepareAssistantTask({ kind: "review_documents" }, directory)
    assert.equal(result.proposed, true)
    if (!result.proposed) return
    assert.equal(result.task.kind, "review_documents")
    assert.match(result.task.detail, /Nothing changes until you confirm/)
  })

  it("refuses a team that is not on the list", () => {
    const result = prepareAssistantTask(
      {
        kind: "add_worker",
        firstName: "Alex",
        lastName: "Chen",
        email: "alex@example.com",
        team: "Nursing",
      },
      directory
    )
    assert.equal(result.proposed, false)
    if (result.proposed) return
    assert.match(result.reason, /Support/)
  })

  it("proposes filing a policy under the named standard", () => {
    const result = prepareAssistantTask(policy, directory)
    assert.equal(result.proposed, true)
    if (!result.proposed || result.task.kind !== "file_policy") return
    assert.equal(result.task.standardCode, "core.privacy")
    assert.equal(result.task.draft.organisation, "Abbacare")
    assert.match(policyRecordBody(result.task.draft), /Draft. This policy has not been accepted/)
  })

  it("does not propose a change the person cannot make", () => {
    const result = prepareAssistantTask({ kind: "review_documents" }, { ...directory, allowed: [] })
    assert.equal(result.proposed, false)
  })
})

describe("assistant task cards", () => {
  it("reads a proposal and remembers a cancellation", () => {
    const prepared = prepareAssistantTask(
      {
        kind: "add_worker",
        firstName: "Alex",
        lastName: "Chen",
        email: "alex@example.com",
        team: "Support",
      },
      directory
    )
    assert.equal(prepared.proposed, true)
    if (!prepared.proposed) return
    const stored = toStoredMessages(
      [
        {
          id: "a1",
          role: "assistant",
          parts: [
            { type: "text", text: "Confirm this before I add Alex." },
            {
              type: "tool-propose_task",
              state: "output-available",
              toolCallId: "call-1",
              input: { kind: "add_worker" },
              output: prepared,
            },
          ],
        },
      ],
      [],
      { "call-1": { status: "cancelled", result: "Cancelled. Nothing was changed." } }
    )
    assert.equal(stored[0]?.tasks?.[0]?.status, "cancelled")
    assert.equal(stored[0]?.tasks?.[0]?.kind, "add_worker")
    const again = toStoredMessages(
      [{ id: "a1", role: "assistant", parts: [{ type: "text", text: "Confirm this before I add Alex." }] }],
      stored
    )
    assert.equal(again[0]?.tasks?.[0]?.status, "cancelled")
  })

  it("authorises a confirmed worker against the live team list", () => {
    const prepared = prepareAssistantTask(
      {
        kind: "add_worker",
        firstName: "Alex",
        lastName: "Chen",
        email: "Alex@Example.com",
        team: "support",
      },
      directory
    )
    assert.equal(prepared.proposed, true)
    if (!prepared.proposed) return
    const card = tasksFromParts([
      {
        type: "tool-propose_task",
        state: "output-available",
        toolCallId: "call-2",
        input: { kind: "add_worker" },
        output: prepared,
      },
    ])
    const allowed = authoriseAssistantTask(card[0], directory)
    assert.equal(allowed.proposed, true)
    if (!allowed.proposed || allowed.task.kind !== "add_worker") return
    assert.equal(allowed.task.email, "alex@example.com")
    assert.equal(allowed.task.team, "support")
  })
})
