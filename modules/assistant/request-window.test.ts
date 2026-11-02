import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { UIMessage } from "ai"

import { certificateBatchBytes, certificateBatchSize, certificateTooLarge } from "@/modules/assistant/attachments"
import { interviewRequest, requestWindow } from "@/modules/assistant/request-window"

const say = (id: string, role: UIMessage["role"] = "user"): UIMessage => ({
  id,
  role,
  parts: [{ type: "text", text: id }],
})

const attach = (id: string, size: number): UIMessage => ({
  id,
  role: "user",
  parts: [
    { type: "text", text: id },
    { type: "file", mediaType: "application/pdf", filename: `${id}.pdf`, url: "a".repeat(size) },
  ],
})

const fileNames = (messages: UIMessage[]) =>
  messages.flatMap((message) => message.parts.flatMap((part) => (part.type === "file" ? [part.filename] : [])))

describe("requestWindow", () => {
  it("sends only the messages the server reads", () => {
    const messages = Array.from({ length: 10 }, (_, index) => say(`m${index}`))
    assert.deepEqual(requestWindow(messages, { limit: 3 }).map((message) => message.id), ["m7", "m8", "m9"])
  })

  it("keeps the audit's first message for its chosen groups", () => {
    const messages = Array.from({ length: 10 }, (_, index) => say(`m${index}`))
    assert.deepEqual(
      requestWindow(messages, { limit: 2, keepFirstUser: true }).map((message) => message.id),
      ["m0", "m8", "m9"]
    )
  })

  it("keeps older files while they fit, so a follow up can still read them", () => {
    const sent = requestWindow([attach("a", 1000), say("b"), say("c")], { limit: 6, byteBudget: 5000 })
    assert.deepEqual(fileNames(sent), ["a.pdf"])
  })

  it("drops the oldest files first and always sends the newest whole", () => {
    const sent = requestWindow(
      [attach("old", 3000), attach("mid", 3000), attach("new", 4000)],
      { limit: 6, byteBudget: 8000 }
    )
    assert.deepEqual(fileNames(sent), ["mid.pdf", "new.pdf"])
    assert.match(JSON.stringify(sent[0]?.parts), /old\.pdf was attached earlier/)
    assert.ok(JSON.stringify(sent).length < 9000)
  })

  it("does not change the messages on screen", () => {
    const messages = [attach("old", 3000), attach("new", 3000)]
    requestWindow(messages, { limit: 6, byteBudget: 3100 })
    assert.equal(messages[0]?.parts.length, 2)
    assert.equal(messages[0]?.parts[1]?.type, "file")
  })

  it("an interview sends only the new answer", () => {
    assert.deepEqual(interviewRequest([say("a"), say("b", "assistant"), say("c")]).map((message) => message.id), ["c"])
  })
})

describe("certificateBatchSize", () => {
  it("batches by bytes as well as count", () => {
    const mb = 1024 * 1024
    assert.equal(certificateBatchSize([mb, mb, mb, mb, mb]), 3)
    assert.equal(certificateBatchSize(Array.from({ length: 20 }, () => 1000)), 12)
    assert.equal(certificateBatchSize([]), 0)
  })

  it("reports a file too large to send", () => {
    assert.equal(certificateBatchSize([certificateBatchBytes]), 0)
    assert.equal(certificateTooLarge(certificateBatchBytes), true)
    assert.equal(certificateTooLarge(3 * 1024 * 1024), false)
  })

  it("every batch stays under the Vercel request limit", () => {
    const sizes = Array.from({ length: 40 }, (_, index) => (index % 3 === 0 ? 3_500_000 : 300_000))
    let remaining = sizes
    while (remaining.length > 0) {
      const count = certificateBatchSize(remaining)
      assert.ok(count > 0)
      const total = remaining.slice(0, count).reduce((sum, size) => sum + size, 0)
      assert.ok(total <= 4_500_000)
      remaining = remaining.slice(count)
    }
  })
})
