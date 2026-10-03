import assert from "node:assert/strict"
import { test } from "node:test"

import {
  incidentKindLabel,
  incidentStanding,
  incidentStandingLabel,
} from "@/modules/incidents/standing"

test("a draft incident does not count", () => {
  assert.equal(incidentStanding("draft"), "draft")
  assert.equal(incidentStandingLabel("draft"), "Draft")
})

test("an accepted incident is recorded", () => {
  assert.equal(incidentStanding("accepted"), "recorded")
  assert.equal(incidentStandingLabel("recorded"), "Recorded")
})

test("kind labels", () => {
  assert.equal(incidentKindLabel("incident"), "Incident")
  assert.equal(incidentKindLabel("complaint"), "Complaint")
  assert.equal(incidentKindLabel("risk"), "Risk")
  assert.equal(incidentKindLabel("restrictive_practice"), "Restrictive practice")
})
