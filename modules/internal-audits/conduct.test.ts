import assert from "node:assert/strict"
import { test } from "node:test"

import { registrationGroupChoices } from "@/lib/ndis-registration-groups"
import {
  auditSelectionPrefix,
  chosenAuditGroups,
  conductInstructions,
  externalAuditKind,
  findingsFromParts,
  parseAuditFinding,
} from "@/modules/internal-audits/conduct"

test("household tasks prepare for a verification audit", () => {
  assert.equal(externalAuditKind(["0120"]), "verification")
  const text = conductInstructions(["0120"])
  assert.match(text, /verification audit/)
  assert.match(text, /desktop review/)
  assert.match(text, /not the NDIS Commission's audit/)
  assert.match(text, /Human resource management/)
  assert.doesNotMatch(text, /Person-centred supports/)
})

test("personal activities prepare for a certification audit", () => {
  assert.equal(externalAuditKind(["0107"]), "certification")
  const text = conductInstructions(["0107"])
  assert.match(text, /certification audit/)
  assert.match(text, /what a participant would say/)
  assert.match(text, /record_finding/)
  assert.match(text, /not_applicable/)
  assert.match(text, /Person-centred supports/)
})

test("every held registration group is offered, in the official order", () => {
  const choices = registrationGroupChoices(["0132", "0115", "0120", "9999"])
  assert.deepEqual(
    choices.map((choice) => choice.code),
    ["0115", "0120", "0132"]
  )
  assert.match(choices[0]?.label ?? "", /0115 ·/)
})

test("the selection keeps only the registration groups the person chose", () => {
  const held = ["0115", "0117", "0124", "0132"] as const
  const chosen = chosenAuditGroups(
    [
      {
        role: "user",
        parts: [
          {
            type: "text",
            text: `${auditSelectionPrefix}\n0115 · Assistance with daily life tasks in a group or shared living arrangement`,
          },
        ],
      },
    ],
    held
  )
  assert.deepEqual(chosen, ["0115"])
  const text = conductInstructions(chosen)
  assert.match(text, /0115 ·/)
  assert.match(text, /Implementing behaviour support plans/)
  assert.doesNotMatch(text, /Specialised support coordination/)
})

test("a later message does not change the groups that were chosen", () => {
  const chosen = chosenAuditGroups(
    [
      {
        role: "user",
        parts: [{ type: "text", text: `${auditSelectionPrefix}\n0120 · Household tasks` }],
      },
      { role: "assistant", parts: [{ type: "text", text: "Starting with household tasks." }] },
      { role: "user", parts: [{ type: "text", text: "Also look at 0132" }] },
    ],
    ["0120", "0132"]
  )
  assert.deepEqual(chosen, ["0120"])
})

test("a group the provider does not hold is left out", () => {
  const chosen = chosenAuditGroups(
    [
      {
        role: "user",
        parts: [{ type: "text", text: `${auditSelectionPrefix}\n0104 · High Intensity Daily Personal Activities` }],
      },
    ],
    ["0120"]
  )
  assert.deepEqual(chosen, ["0120"])
})

test("support coordination adds its own criteria", () => {
  const text = conductInstructions(["0132"])
  assert.match(text, /Specialised support coordination/)
  assert.match(text, /Management of supports/)
  assert.match(text, /every criterion/)
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
