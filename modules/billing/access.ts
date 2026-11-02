export const TRIAL_DAYS = 7
export const MINIMUM_SEATS = 1

export const BILLING_PLANS = ["staff", "registered"] as const
export type BillingPlan = (typeof BILLING_PLANS)[number]

export const BILLING_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "paused",
] as const
export type BillingStatus = (typeof BILLING_STATUSES)[number]

export type BillingSnapshot = {
  plan: BillingPlan | null
  status: BillingStatus | null
  trialEndsAt: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

export function isBillingPlan(value: unknown): value is BillingPlan {
  return value === "staff" || value === "registered"
}

export function isBillingStatus(value: unknown): value is BillingStatus {
  return (
    value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "incomplete" ||
    value === "paused"
  )
}

export function planAmount(plan: BillingPlan) {
  switch (plan) {
    case "staff":
      return 8
    case "registered":
      return 12
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

export function planLabel(plan: BillingPlan) {
  switch (plan) {
    case "staff":
      return "Staff"
    case "registered":
      return "Registered"
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

export function billedSeats(activeWorkers: number) {
  return Math.max(activeWorkers, MINIMUM_SEATS)
}

export function trialDaysRemaining(
  trialEndsAt: string | null,
  now = new Date()
) {
  if (!trialEndsAt) return 0
  const end = new Date(trialEndsAt).getTime()
  if (Number.isNaN(end) || end <= now.getTime()) return 0
  return Math.ceil((end - now.getTime()) / (24 * 60 * 60 * 1000))
}

function trialOpen(billing: BillingSnapshot, now: Date) {
  return trialDaysRemaining(billing.trialEndsAt, now) > 0
}

export function trialHasEnded(billing: BillingSnapshot, now = new Date()) {
  switch (billing.status) {
    case "active":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "paused":
      return false
    case "trialing":
    case null:
      return !trialOpen(billing, now)
    default: {
      const unreachable: never = billing.status
      return unreachable
    }
  }
}

// Staff features need any live subscription or an open trial. Records stay
// readable either way; this closes adding and changing them.
export function allowsStaff(
  billing: BillingSnapshot,
  now = new Date(),
  stripeConfigured = true
) {
  if (!stripeConfigured) return true

  switch (billing.status) {
    case "active":
      return billing.plan !== null
    case "past_due":
    case "canceled":
    case "incomplete":
    case "paused":
      return false
    case "trialing":
      return billing.plan !== null || trialOpen(billing, now)
    case null:
      return trialOpen(billing, now)
    default: {
      const unreachable: never = billing.status
      return unreachable
    }
  }
}

export function allowsRegistered(
  billing: BillingSnapshot,
  now = new Date(),
  stripeConfigured = true
) {
  if (!stripeConfigured) return true

  switch (billing.status) {
    case "active":
      return billing.plan === "registered"
    case "past_due":
      return false
    case "trialing":
      if (billing.plan === "staff") return false
      if (billing.plan === "registered") return true
      return trialOpen(billing, now)
    case "canceled":
    case "incomplete":
    case "paused":
      return false
    case null:
      return trialOpen(billing, now)
    default: {
      const unreachable: never = billing.status
      return unreachable
    }
  }
}

export type BillingNotice = {
  message: string
  action?: { href: string; label: string }
}

const addPlan = { href: "/settings/billing", label: "Add payment plan" }

export function billingNotice(
  billing: BillingSnapshot,
  stripeConfigured: boolean
): BillingNotice | null {
  if (!stripeConfigured) return null
  const days = trialDaysRemaining(billing.trialEndsAt)

  switch (billing.status) {
    case "past_due":
      return {
        message:
          "A subscription payment did not go through. Registered features stay paused until the card is updated.",
      }
    case "canceled":
      return {
        message:
          "The subscription has ended. Choose a plan to restore Registered features.",
        action: addPlan,
      }
    case "incomplete":
    case "paused":
      return {
        message:
          "Billing needs attention before Registered features stay available.",
      }
    case "trialing":
    case null:
      if (days <= 0) return null
      return {
        message:
          days === 1
            ? "The free trial ends tomorrow."
            : `The free trial ends in ${days} days.`,
        action: addPlan,
      }
    case "active":
      return null
    default: {
      const unreachable: never = billing.status
      return unreachable
    }
  }
}
