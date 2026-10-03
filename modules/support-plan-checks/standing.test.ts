import assert from "node:assert/strict"
import { test } from "node:test"

import {
  supportPlanCheckResult,
  supportPlanCheckResultLabel,
  supportPlanCheckStanding,
  supportPlanCheckStandingLabel,
} from "@/modules/support-plan-checks/standing"

test("a draft support plan check does not count", () => {
  assert.equal(supportPlanCheckStanding("draft"), "draft")
  assert.equal(supportPlanCheckStanding("accepted"), "recorded")
  assert.equal(supportPlanCheckStandingLabel("draft"), "Draft")
  assert.equal(supportPlanCheckStandingLabel("recorded"), "Recorded")
})

test("a check says whether support followed the plan", () => {
  assert.equal(supportPlanCheckResult(true), "followed")
  assert.equal(supportPlanCheckResult(false), "not_followed")
  assert.equal(supportPlanCheckResultLabel("followed"), "Followed")
  assert.equal(supportPlanCheckResultLabel("not_followed"), "Not followed")
})
