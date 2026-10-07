import assert from "node:assert/strict"
import test from "node:test"

import {
  TRIAL_ASSISTANT_TOKENS,
  assistantAllowance,
  assistantUsageMeter,
} from "@/modules/assistant/allowance"
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

test("an active subscription is not capped", () => {
  const allowance = assistantAllowance({
    billing: billing({ plan: "staff", status: "active", trialEndsAt: null }),
    tokensUsed: TRIAL_ASSISTANT_TOKENS + 10_000,
    now,
  })
  assert.equal(allowance.kind, "open")
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
  assert.deepEqual(meter, { used: 12_500, included: TRIAL_ASSISTANT_TOKENS, percent: 25 })
})

test("an open plan has no assistant cap", () => {
  const meter = assistantUsageMeter(80_000, { kind: "open" })
  assert.deepEqual(meter, { used: 80_000, included: null, percent: null })
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
