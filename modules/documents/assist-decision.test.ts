import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  assistantDocumentDecision,
  documentReviewLabel,
  type DocumentRead,
} from "@/modules/documents/assist-decision"

const today = "2026-10-07"

function read(overrides: Partial<DocumentRead> = {}): DocumentRead {
  return {
    readable: true,
    typeMatches: true,
    nameMatches: true,
    confident: true,
    expirySeen: "future",
    note: "Looks current.",
    ...overrides,
  }
}

describe("assistant document decision", () => {
  it("approves a readable current document", () => {
    const result = assistantDocumentDecision({
      read: read(),
      requiresExpiry: true,
      expiresOn: "2027-01-01",
      today,
    })
    assert.equal(result.decision, "approve")
  })

  it("flags a document for a person instead of rejecting it", () => {
    const cases: Array<Partial<DocumentRead>> = [
      { readable: false, note: "The file could not be read." },
      { nameMatches: false, note: "The name does not match the worker." },
      { typeMatches: false, note: "This is not the document type on the record." },
      { confident: false, note: "The signature needs a person to check it." },
      { expirySeen: "past", note: "The date on the file has passed." },
    ]
    for (const item of cases) {
      const result = assistantDocumentDecision({
        read: read(item),
        requiresExpiry: true,
        expiresOn: "2027-01-01",
        today,
      })
      assert.equal(result.decision, "flag", item.note)
    }
  })

  it("flags when the expiry on the record is missing or past", () => {
    assert.equal(
      assistantDocumentDecision({
        read: read(),
        requiresExpiry: true,
        expiresOn: null,
        today,
      }).decision,
      "flag"
    )
    assert.equal(
      assistantDocumentDecision({
        read: read(),
        requiresExpiry: true,
        expiresOn: "2026-01-01",
        today,
      }).decision,
      "flag"
    )
  })

  it("names a flagged pending document for the approvals queue", () => {
    assert.equal(documentReviewLabel("pending", true), "Needs a person")
    assert.equal(documentReviewLabel("pending", false), "Pending")
    assert.equal(documentReviewLabel("approved", false), "Approved")
  })
})
