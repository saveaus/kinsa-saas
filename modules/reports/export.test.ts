import assert from "node:assert/strict"
import test from "node:test"

import { organisationCsv } from "@/modules/reports/export"
import type { OrganisationEvidence } from "@/modules/reports/dossier"

const evidence: OrganisationEvidence = {
  organisationName: "Abbacare",
  groups: "0107 · Daily personal activities",
  generatedOn: "13 Oct 2026",
  readiness: "2 of 4 (50%)",
  sections: [
    {
      title: "Policies",
      columns: ["Policy", "Standard", "Standing", "Detail"],
      rows: [["Rights", "Rights and responsibilities", "Current", "policy.docx"]],
      empty: "No policies on file.",
    },
    {
      title: "Registers",
      columns: ["Register", "Record", "When", "Detail"],
      rows: [],
      empty: "No registers are turned on.",
    },
  ],
}

test("the organisation pack lists each workspace section", () => {
  const csv = organisationCsv(evidence)
  assert.match(csv, /Organisation,Abbacare/)
  assert.match(csv, /Audit pack,2 of 4 \(50%\)/)
  assert.match(csv, /Policies\nPolicy,Standard,Standing,Detail\nRights,/)
  assert.match(csv, /Registers\nRegister,Record,When,Detail\nNo registers are turned on\./)
  assert.match(csv, /not an audit certificate/)
})
