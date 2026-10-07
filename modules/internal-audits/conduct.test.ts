import assert from "node:assert/strict"
import { test } from "node:test"

import {
  conductInstructions,
  externalAuditKind,
  findingsFromParts,
  parseAuditFinding,
} from "@/modules/internal-audits/conduct"

test("household tasks prepare for a verification audit", () => {
  assert.equal(externalAuditKind(["0120"]), "verification")
  const text = conductInstructions("verification")
  assert.match(text, /verification audit/)
  assert.match(text, /desktop review/)
  assert.match(text, /not the NDIS Commission's audit/)
})

test("personal activities prepare for a certification audit", () => {
  assert.equal(externalAuditKind(["0107"]), "certification")
  const text = conductInstructions("certification")
  assert.match(text, /certification audit/)
  assert.match(text, /what a participant would say/)
  assert.match(text, /record_finding/)
  assert.match(text, /not_applicable/)
})

test("a finding needs an action, an owner, and a way to check it", () => {
  const finding = parseAuditFinding({
    area: "Workers",
    rating: "partial",
    finding: "Two worker files have no screening check.",
    action: "Collect the missing screening checks.",
    owner: "Provider",
    check: "Open the worker files and confirm each check is current.",
  })
  assert.equal(finding?.rating, "partial")
  assert.equal(parseAuditFinding({ rating: "met" }), null)
  assert.equal(
    findingsFromParts([
      {
        type: "tool-record_finding",
        state: "output-available",
        output: finding,
      },
    ]).length,
    1
  )
})
