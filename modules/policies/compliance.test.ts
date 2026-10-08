import assert from "node:assert/strict"
import { test } from "node:test"

import {
  docxPlainText,
  policyComplianceDecision,
} from "@/modules/policies/compliance-check"
import {
  isPolicyFlagPrompt,
  policyFlagId,
  policyFlagPrompt,
} from "@/modules/policies/flag-prompt"

test("a current policy is not flagged", () => {
  assert.deepEqual(policyComplianceDecision({ current: true, gaps: [] }), {
    flagged: false,
    note: null,
  })
  assert.deepEqual(policyComplianceDecision(null), {
    flagged: false,
    note: null,
  })
})

test("gaps are kept when the policy is not current", () => {
  const result = policyComplianceDecision({
    current: false,
    gaps: ["It skips mealtime management.", ""],
  })
  assert.equal(result.flagged, true)
  assert.equal(result.note, "It skips mealtime management.")
})

test("the flag prompt names the policy and keeps its id", () => {
  const id = "7b7d3fe9-3c5c-4fde-8d8c-cc671888608c"
  const prompt = policyFlagPrompt({
    id,
    name: "Mealtime management",
    standardName: "Mealtime management",
    note: "It skips the current outcome.",
  })
  assert.equal(isPolicyFlagPrompt(prompt), true)
  assert.equal(policyFlagId(prompt), id)
  assert.match(prompt, /Why isn't "Mealtime management"/)
})

test("word text is read from the document", () => {
  const xml = "<w:p>Mealtime <w:t>management</w:t></w:p>"
  const text = docxPlainText(storedZip("word/document.xml", xml))
  assert.equal(text, "Mealtime management")
})

function storedZip(name: string, contents: string) {
  const fileName = new TextEncoder().encode(name)
  const data = new TextEncoder().encode(contents)
  const header = Buffer.alloc(30)
  header.writeUInt32LE(0x04034b50, 0)
  header.writeUInt16LE(fileName.length, 26)
  header.writeUInt32LE(data.length, 18)
  header.writeUInt32LE(data.length, 22)
  return new Uint8Array(Buffer.concat([header, fileName, data]))
}
