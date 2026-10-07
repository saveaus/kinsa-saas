import assert from "node:assert/strict"
import test from "node:test"

import {
  allowsRegistered,
  billedSeats,
  planAmount,
  trialDaysRemaining,
  type BillingSnapshot,
} from "@/modules/billing/access"

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

test("a trial with no plan chosen includes Registered", () => {
  assert.equal(allowsRegistered(billing(), now), true)
})

test("an active Staff subscription does not include Registered", () => {
  assert.equal(
    allowsRegistered(
      billing({ plan: "staff", status: "active", trialEndsAt: null }),
      now
    ),
    false
  )
})

test("a past due Registered subscription does not include Registered", () => {
  assert.equal(
    allowsRegistered(
      billing({ plan: "registered", status: "past_due", trialEndsAt: null }),
      now
    ),
    false
  )
})

test("an active Registered subscription includes Registered", () => {
  assert.equal(
    allowsRegistered(
      billing({ plan: "registered", status: "active", trialEndsAt: null }),
      now
    ),
    true
  )
})

test("choosing Staff during the trial limits the account to Staff", () => {
  assert.equal(
    allowsRegistered(billing({ plan: "staff", status: "trialing" }), now),
    false
  )
})

test("a canceled subscription does not include Registered", () => {
  assert.equal(
    allowsRegistered(
      billing({ plan: "registered", status: "canceled", trialEndsAt: null }),
      now
    ),
    false
  )
})

test("billing stays open when Stripe is not configured", () => {
  assert.equal(
    allowsRegistered(
      billing({ plan: "staff", status: "active", trialEndsAt: null }),
      now,
      false
    ),
    true
  )
})

test("trial days remaining counts the last partial day", () => {
  assert.equal(trialDaysRemaining("2026-10-04T12:00:00.000Z", now), 1)
  assert.equal(trialDaysRemaining("2026-10-03T00:00:00.000Z", now), 0)
})

test("plans are priced per active worker", () => {
  assert.equal(planAmount("staff"), 8)
  assert.equal(planAmount("registered"), 12)
})

test("billed seats are at least one", () => {
  assert.equal(billedSeats(0), 1)
  assert.equal(billedSeats(4), 4)
})
