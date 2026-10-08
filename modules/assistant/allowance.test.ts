import assert from "node:assert/strict"
import test from "node:test"

import {
  PAID_ASSISTANT_TOKENS_PER_SEAT,
  TRIAL_ASSISTANT_TOKENS,
  assistantAllowance,
  assistantAllowanceMessage,
  assistantUpgrade,
  assistantUsageMeter,
  paidAssistantTokens,
} from "@/modules/assistant/allowance"
import { assistantReplyBudget } from "@/modules/assistant/model"
import type { BillingSnapshot } from "@/modules/billing/access"

const now = new Date("2026-10-04T00:00:00.000Z")

function billing(overrides: Partial<BillingSnapshot> = {}): BillingSnapshot {
  return {
    plan: null,
    status: "trialing",
    trialEndsAt: "2026-10-18T00:00:00.000Z",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    ...overrides,
  }
}

test("a trial under the cap can still use the assistant", () => {
  const allowance = assistantAllowance({
    billing: billing(),
    tokensUsed: 1_000,
    now,
  })
  assert.deepEqual(allowance, {
    kind: "trial",
    remaining: TRIAL_ASSISTANT_TOKENS - 1_000,
    included: TRIAL_ASSISTANT_TOKENS,
  })
})

test("a trial at the cap is stopped", () => {
  const allowance = assistantAllowance({
    billing: billing({ plan: "staff" }),
    tokensUsed: TRIAL_ASSISTANT_TOKENS,
    now,
  })
  assert.equal(allowance.kind, "spent")
})

test("an active subscription is capped each month per billed worker", () => {
  const allowance = assistantAllowance({
    billing: billing({ plan: "staff", status: "active", trialEndsAt: null }),
    tokensUsed: 10_000,
    periodStart: "2026-10-01T00:00:00.000Z",
    seats: 2,
    now,
  })
  assert.deepEqual(allowance, {
    kind: "included",
    remaining: paidAssistantTokens(2) - 10_000,
    included: PAID_ASSISTANT_TOKENS_PER_SEAT * 2,
  })
})

test("last month's usage does not count against this month", () => {
  const allowance = assistantAllowance({
    billing: billing({ plan: "registered", status: "active", trialEndsAt: null }),
    tokensUsed: paidAssistantTokens(1),
    periodStart: "2026-09-01T00:00:00.000Z",
    seats: 1,
    now,
  })
  assert.equal(allowance.kind, "included")
  if (allowance.kind === "included") assert.equal(allowance.remaining, paidAssistantTokens(1))
})

test("a paid organisation at the monthly cap is stopped until next month", () => {
  const allowance = assistantAllowance({
    billing: billing({ plan: "registered", status: "active", trialEndsAt: null }),
    tokensUsed: paidAssistantTokens(1),
    periodStart: "2026-10-02T00:00:00.000Z",
    seats: 1,
    now,
  })
  assert.equal(allowance.kind, "spent")
  if (allowance.kind === "spent") {
    assert.equal(allowance.reset, "month")
    assert.match(assistantAllowanceMessage(allowance), /resets at the start of next month/)
  }
})

test("a used trial tells an administrator to upgrade", () => {
  const allowance = assistantAllowance({
    billing: billing(),
    tokensUsed: TRIAL_ASSISTANT_TOKENS,
    now,
  })
  const upgrade = assistantUpgrade(allowance, true)
  assert.equal(upgrade?.href, "/settings/billing")
  assert.equal(upgrade?.label, "Upgrade")
  assert.match(upgrade?.message ?? "", /Add a plan to keep going/)
  assert.equal(assistantUpgrade(allowance, false)?.href, null)
})

test("an open allowance does not ask for an upgrade", () => {
  assert.equal(
    assistantUpgrade(
      assistantAllowance({
        billing: billing(),
        tokensUsed: 1_000,
        now,
        stripeConfigured: false,
      }),
      true
    ),
    null
  )
})

test("a past due subscription does not keep the assistant", () => {
  const allowance = assistantAllowance({
    billing: billing({ plan: "registered", status: "past_due", trialEndsAt: null }),
    tokensUsed: 0,
    now,
  })
  assert.equal(allowance.kind, "ended")
})

test("an expired trial does not keep the allowance", () => {
  const allowance = assistantAllowance({
    billing: billing({ trialEndsAt: "2026-10-03T00:00:00.000Z" }),
    tokensUsed: 0,
    now,
  })
  assert.equal(allowance.kind, "ended")
})

test("a canceled subscription does not keep the allowance", () => {
  const allowance = assistantAllowance({
    billing: billing({ plan: "registered", status: "canceled", trialEndsAt: null }),
    tokensUsed: 0,
    now,
  })
  assert.equal(allowance.kind, "ended")
})

test("a trial meter fills against the included tokens", () => {
  const meter = assistantUsageMeter(
    12_500,
    assistantAllowance({ billing: billing(), tokensUsed: 12_500, now })
  )
  assert.deepEqual(meter, {
    used: 12_500,
    included: TRIAL_ASSISTANT_TOKENS,
    percent: 25,
    period: "trial",
  })
})

test("an open plan has no assistant cap", () => {
  const meter = assistantUsageMeter(80_000, { kind: "open" })
  assert.deepEqual(meter, { used: 80_000, included: null, percent: null, period: null })
})

test("a normal question keeps a short reply and a policy draft can be long", () => {
  assert.equal(assistantReplyBudget("general", "What is still missing?"), 600)
  assert.equal(assistantReplyBudget("general", "Draft a complaints policy"), 2200)
  assert.equal(assistantReplyBudget("interview", "Draft a policy"), 700)
})

test("local development without Stripe is not capped", () => {
  const allowance = assistantAllowance({
    billing: billing(),
    tokensUsed: TRIAL_ASSISTANT_TOKENS,
    now,
    stripeConfigured: false,
  })
  assert.equal(allowance.kind, "open")
})
