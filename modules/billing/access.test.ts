import assert from "node:assert/strict"
import test from "node:test"

import {
  allowsRegistered,
  allowsStaff,
  billedSeats,
  planAmount,
  trialDaysRemaining,
  trialHasEnded,
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

test("a trial with no days left has ended", () => {
  assert.equal(trialHasEnded(billing({ trialEndsAt: "2026-10-03T00:00:00.000Z" }), now), true)
  assert.equal(trialHasEnded(billing(), now), false)
  assert.equal(
    trialHasEnded(billing({ plan: "registered", status: "active", trialEndsAt: null }), now),
    false
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

test("Staff features need a live subscription or an open trial", () => {
  const ended = "2026-10-01T00:00:00.000Z"
  assert.equal(allowsStaff(billing(), now), true)
  assert.equal(allowsStaff(billing({ trialEndsAt: ended }), now), false)
  assert.equal(allowsStaff(billing({ status: "active", plan: "staff" }), now), true)
  assert.equal(allowsStaff(billing({ status: "canceled", plan: "staff" }), now), false)
  assert.equal(allowsStaff(billing({ status: "past_due", plan: "registered" }), now), false)
  assert.equal(allowsStaff(billing({ status: "canceled" }), now, false), true)
})
