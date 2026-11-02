import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { UIMessage } from "ai"

import { expandAttachmentText, imageMediaType } from "@/modules/assistant/attachment-text"
import {
  acceptAttachments,
  attachmentByteLimit,
  attachmentTotalLimit,
  attachmentsFromParts,
  pasteAsAttachment,
  pastedTextName,
} from "@/modules/assistant/attachments"
import { toStoredMessages } from "@/modules/assistant/messages"
import { policyDocxType } from "@/modules/policies/attachments"

function storedZip(name: string, content: string) {
  const encoder = new TextEncoder()
  const nameBytes = encoder.encode(name)
  const data = encoder.encode(content)
  const bytes = new Uint8Array(30 + nameBytes.length + data.length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, 0x04034b50, true)
  view.setUint32(18, data.length, true)
  view.setUint16(26, nameBytes.length, true)
  bytes.set(nameBytes, 30)
  bytes.set(data, 30 + nameBytes.length)
  return bytes
}

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

  it("rejects an old Word file with a clear reason", () => {
    const decision = acceptAttachments(
      [],
      [
        { name: "policy.doc", size: 20 },
        { name: "policy.docx", size: 20 },
      ]
    )
    assert.deepEqual(decision.accepted, [1])
    assert.match(decision.rejected[0] ?? "", /old Word file.*\.docx or PDF/)
  })

  it("keeps a whole message under the Vercel request limit once it is base64", () => {
    const decision = acceptAttachments(
      [],
      [
        { name: "a.pdf", size: 2 * 1024 * 1024 },
        { name: "b.pdf", size: 2 * 1024 * 1024 },
      ]
    )
    assert.deepEqual(decision.accepted, [0])
    assert.match(decision.rejected[0] ?? "", /3 MB together/)
    assert.ok((attachmentTotalLimit * 4) / 3 < 4_400_000)
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

  const fileOf = (mediaType: string, filename: string, url: string): UIMessage[] => [
    { id: "1", role: "user", parts: [{ type: "file", mediaType, filename, url }] },
  ]
  const textOf = (messages: UIMessage[]) =>
    messages[0]?.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n") ?? ""
  const filesOf = (messages: UIMessage[]) =>
    messages[0]?.parts.filter((part) => part.type === "file") ?? []

  it("sends a text file as an excerpt only, not twice", () => {
    const url = `data:text/plain;base64,${Buffer.from("Hello there").toString("base64")}`
    const expanded = expandAttachmentText(fileOf("text/plain", "notes.txt", url), 800)
    assert.equal(filesOf(expanded).length, 0)
    assert.match(textOf(expanded), /Hello there/)
  })

  it("reads the text out of a .docx and does not pass the file on", () => {
    const docx = storedZip(
      "word/document.xml",
      "<w:document><w:p><w:r><w:t>Complaints are closed in 21 days.</w:t></w:r></w:p></w:document>"
    )
    const url = `data:${policyDocxType};base64,${Buffer.from(docx).toString("base64")}`
    const expanded = expandAttachmentText(fileOf(policyDocxType, "policy.docx", url), 800)
    assert.equal(filesOf(expanded).length, 0)
    assert.match(textOf(expanded), /Complaints are closed in 21 days/)
  })

  it("says so when a .docx cannot be read", () => {
    const url = `data:${policyDocxType};base64,${Buffer.from("not a zip").toString("base64")}`
    const expanded = expandAttachmentText(fileOf(policyDocxType, "policy.docx", url), 800)
    assert.equal(filesOf(expanded).length, 0)
    assert.match(textOf(expanded), /could not be read/)
  })

  it("turns an old .doc into a note the model can pass on", () => {
    const url = `data:application/msword;base64,${Buffer.from("old").toString("base64")}`
    const expanded = expandAttachmentText(fileOf("application/msword", "policy.doc", url), 800)
    assert.equal(filesOf(expanded).length, 0)
    assert.match(textOf(expanded), /old Word \.doc file/)
  })

  it("only passes PDFs and images on as files", () => {
    const pdf = "data:application/pdf;base64,JVBERi0="
    assert.equal(filesOf(expandAttachmentText(fileOf("application/pdf", "a.pdf", pdf), 800)).length, 1)
    const unnamedType = "data:application/octet-stream;base64,JVBERi0="
    const named = filesOf(expandAttachmentText(fileOf("", "a.pdf", unnamedType), 800))[0]
    assert.equal(named?.type === "file" ? named.mediaType : "", "application/pdf")
    const sheet = "data:application/vnd.ms-excel;base64,AAAA"
    const other = expandAttachmentText(fileOf("application/vnd.ms-excel", "a.xls", sheet), 800)
    assert.equal(filesOf(other).length, 0)
    assert.match(textOf(other), /cannot be read here/)
  })

  it("will not pass a web address on for the server to fetch", () => {
    const expanded = expandAttachmentText(fileOf("application/pdf", "a.pdf", "https://example.com/a.pdf"), 800)
    assert.equal(filesOf(expanded).length, 0)
    assert.match(textOf(expanded), /could not be read/)
  })

  it("applies the trial size limit to files, not to text it can excerpt", () => {
    const big = Buffer.from("x".repeat(30_000)).toString("base64")
    const text = expandAttachmentText(fileOf("text/plain", "a.txt", `data:text/plain;base64,${big}`), 800, 16_000)
    assert.doesNotMatch(textOf(text), /too large/)
    const pdf = expandAttachmentText(fileOf("application/pdf", "a.pdf", `data:application/pdf;base64,${big}`), 800, 16_000)
    assert.equal(filesOf(pdf).length, 0)
    assert.match(textOf(pdf), /too large to read/)
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

it("a long chat keeps its newest messages", () => {
  const messages = Array.from({ length: 205 }, (_, index) => ({
    id: `m${index}`,
    role: "user" as const,
    parts: [{ type: "text" as const, text: `Message ${index}` }],
  }))
  const stored = toStoredMessages(messages)
  assert.equal(stored.length, 200)
  assert.equal(stored.at(-1)?.id, "m204")
})
