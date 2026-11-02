import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { promptChars, settledTokens } from "@/modules/assistant/settlement"

const base = {
  claimed: 4600,
  total: null,
  stepTokens: [] as number[],
  aborted: false,
  promptChars: 8000,
  partialChars: 0,
}

describe("settledTokens", () => {
  it("uses the total across steps when the turn finished", () => {
    assert.equal(settledTokens({ ...base, total: 1200 }), 1200)
    assert.equal(settledTokens({ ...base, total: 9000 }), 9000)
  })

  it("refunds everything when the provider failed before replying", () => {
    assert.equal(settledTokens(base), 0)
  })

  it("charges finished steps and an estimate for the running one after Stop", () => {
    assert.equal(
      settledTokens({ ...base, stepTokens: [1000], aborted: true, partialChars: 400 }),
      1000 + 2100
    )
  })

  it("never charges an estimate past the claim", () => {
    assert.equal(settledTokens({ ...base, aborted: true, promptChars: 400_000 }), 4600)
  })

  it("keeps real usage from finished steps even when it passed the claim", () => {
    assert.equal(settledTokens({ ...base, stepTokens: [6000], aborted: true }), 6000)
  })

  it("keeps the claim when a finished turn did not report usage", () => {
    assert.equal(settledTokens({ ...base, stepTokens: [undefined as unknown as number] }), 4600)
  })
})

describe("promptChars", () => {
  it("counts text and gives a file a flat size rather than its base64 length", () => {
    assert.equal(
      promptChars("abcd", [
        {
          id: "1",
          role: "user",
          parts: [
            { type: "text", text: "12345" },
            { type: "file", mediaType: "application/pdf", url: `data:application/pdf;base64,${"a".repeat(5000)}` },
          ],
        },
      ]),
      4 + 5 + 4000
    )
  })
})
