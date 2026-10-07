import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { UIMessage } from "ai"

import { expandAttachmentText, imageMediaType } from "@/modules/assistant/attachment-text"
import {
  acceptAttachments,
  attachmentByteLimit,
  attachmentsFromParts,
  pasteAsAttachment,
  pastedTextName,
} from "@/modules/assistant/attachments"
import { toStoredMessages } from "@/modules/assistant/messages"

describe("pasteAsAttachment", () => {
  it("keeps a short paste in the message box", () => {
    assert.equal(pasteAsAttachment("Add a worker named Alex."), false)
  })

  it("turns a long paste into a file", () => {
    assert.equal(pasteAsAttachment("Policy text. ".repeat(100)), true)
    assert.equal(pasteAsAttachment(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"].join("\n")), true)
  })
})

describe("acceptAttachments", () => {
  it("rejects an empty file and a file over 3 MB", () => {
    const decision = acceptAttachments(
      [],
      [
        { name: "empty.txt", size: 0 },
        { name: "large.png", size: attachmentByteLimit + 1 },
        { name: "note.txt", size: 20 },
      ]
    )
    assert.deepEqual(decision.accepted, [2])
    assert.equal(decision.rejected.length, 2)
  })

  it("stops after 8 files", () => {
    const incoming = Array.from({ length: 9 }, (_, index) => ({ name: `${index}.txt`, size: 10 }))
    const decision = acceptAttachments([], incoming)
    assert.equal(decision.accepted.length, 8)
    assert.match(decision.rejected[0] ?? "", /8 files/)
  })
})

describe("pastedTextName", () => {
  it("numbers a second pasted note", () => {
    assert.equal(pastedTextName(["Pasted text.txt"]), "Pasted text 2.txt")
  })
})

describe("attachment text", () => {
  it("gives the model the text inside a pasted file", () => {
    const url = `data:text/plain;base64,${Buffer.from("The complaint was closed.").toString("base64")}`
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [
          { type: "text", text: "Read this" },
          { type: "file", mediaType: "text/plain", filename: "Pasted text.txt", url },
        ],
      },
    ]
    const expanded = expandAttachmentText(messages, 800)
    const text = expanded[0]?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n")
    assert.match(text ?? "", /The complaint was closed/)
  })

  it("keeps a small image so the chat can show it again", () => {
    const stored = toStoredMessages([
      {
        id: "1",
        role: "user",
        parts: [
          { type: "file", mediaType: "image/png", filename: "screen.png", url: "data:image/png;base64,aaaa" },
        ],
      },
    ])
    assert.equal(stored[0]?.text, "screen.png")
    assert.equal(stored[0]?.attachments?.[0]?.url, "data:image/png;base64,aaaa")
    const huge = `data:image/png;base64,${"a".repeat(500_001)}`
    const dropped = toStoredMessages([
      {
        id: "2",
        role: "user",
        parts: [{ type: "file", mediaType: "image/png", filename: "big.png", url: huge }],
      },
    ])
    assert.equal(dropped[0]?.attachments?.[0]?.url, undefined)
  })
})

describe("imageMediaType", () => {
  it("reads a PNG that was pasted without an image type", () => {
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const url = `data:application/octet-stream;base64,${bytes.toString("base64")}`
    assert.equal(imageMediaType("", url), "image/png")
    const messages: UIMessage[] = [
      {
        id: "img",
        role: "user",
        parts: [{ type: "file", mediaType: "", filename: "image.png", url }],
      },
    ]
    const expanded = expandAttachmentText(messages, 800)
    const file = expanded[0]?.parts.find((part) => part.type === "file")
    const text = expanded[0]?.parts.find((part) => part.type === "text")
    assert.equal(file && "mediaType" in file ? file.mediaType : "", "image/png")
    assert.equal(text && "text" in text ? text.text : "", "Look at the attached image and say what you can see.")
  })
})

describe("attachmentsFromParts", () => {
  it("reads file parts", () => {
    const files = attachmentsFromParts([
      { type: "file", filename: "notes.txt", mediaType: "text/plain" },
      { type: "text", text: "Hello" },
    ])
    assert.deepEqual(files, [{ name: "notes.txt", mediaType: "text/plain" }])
  })
})
