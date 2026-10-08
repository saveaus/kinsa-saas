import { billedSeats, trialDaysRemaining, type BillingSnapshot } from "@/modules/billing/access"

export const TRIAL_ASSISTANT_TOKENS = 50_000
/** About ten percent of a seat, at Gemini 2.5 Flash list price. */
export const PAID_ASSISTANT_TOKENS_PER_SEAT = 150_000

export type AssistantAllowance =
  | { kind: "open" }
  | { kind: "trial"; remaining: number; included: number }
  | { kind: "included"; remaining: number; included: number }
  | { kind: "spent"; reset: "trial" | "month"; included: number }
  | { kind: "ended" }

export function paidAssistantTokens(seats: number) {
  return PAID_ASSISTANT_TOKENS_PER_SEAT * billedSeats(seats)
}

export function assistantMonthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

/** Trial usage accumulates. A paid plan only counts tokens in the current month. */
export function countedAssistantTokens(input: {
  billing: BillingSnapshot
  tokensUsed: number
  periodStart: string | null
  now?: Date
}) {
  const used = Math.max(0, input.tokensUsed)
  if (input.billing.status !== "active") return used
  if (!input.periodStart) return 0
  const start = new Date(input.periodStart).getTime()
  const month = assistantMonthStart(input.now ?? new Date()).getTime()
  if (Number.isNaN(start) || start < month) return 0
  return used
}

export function assistantAllowance(input: {
  billing: BillingSnapshot
  tokensUsed: number
  periodStart?: string | null
  seats?: number
  now?: Date
  stripeConfigured?: boolean
}): AssistantAllowance {
  const now = input.now ?? new Date()
  if (input.stripeConfigured === false) return { kind: "open" }

  const tokensUsed = countedAssistantTokens({
    billing: input.billing,
    tokensUsed: input.tokensUsed,
    periodStart: input.periodStart ?? null,
    now,
  })

  switch (input.billing.status) {
    case "active": {
      const included = paidAssistantTokens(input.seats ?? 1)
      const remaining = included - tokensUsed
      if (remaining <= 0) return { kind: "spent", reset: "month", included }
      return { kind: "included", remaining, included }
    }
    case "past_due":
      return { kind: "ended" }
    case "trialing":
    case null: {
      if (trialDaysRemaining(input.billing.trialEndsAt, now) <= 0) return { kind: "ended" }
      const remaining = TRIAL_ASSISTANT_TOKENS - Math.max(0, input.tokensUsed)
      if (remaining <= 0) return { kind: "spent", reset: "trial", included: TRIAL_ASSISTANT_TOKENS }
      return { kind: "trial", remaining, included: TRIAL_ASSISTANT_TOKENS }
    }
    case "canceled":
    case "incomplete":
    case "paused":
      return { kind: "ended" }
    default: {
      const unreachable: never = input.billing.status
      return unreachable
    }
  }
}

export function assistantAllowanceMessage(
  allowance: Extract<AssistantAllowance, { kind: "spent" | "ended" }>
) {
  switch (allowance.kind) {
    case "ended":
      return "Add a plan to keep using the assistant."
    case "spent":
      switch (allowance.reset) {
        case "trial":
          return `The free trial includes ${allowance.included.toLocaleString("en-AU")} assistant tokens. That allowance is used. Add a plan to keep going.`
        case "month":
          return `This month's assistant allowance is ${allowance.included.toLocaleString("en-AU")} tokens for this organisation. It is used. It resets at the start of next month.`
        default: {
          const unreachable: never = allowance.reset
          return unreachable
        }
      }
    default: {
      const unreachable: never = allowance
      return unreachable
    }
  }
}

export type AssistantUpgrade = {
  message: string
  href: string | null
  label: "Upgrade" | "Billing"
}

/** A plan change is the next step when the trial allowance is used or the plan has ended. */
export function assistantUpgrade(
  allowance: AssistantAllowance,
  canManageBilling: boolean
): AssistantUpgrade | null {
  if (allowance.kind !== "spent" && allowance.kind !== "ended") return null
  const monthly = allowance.kind === "spent" && allowance.reset === "month"
  return {
    message: assistantAllowanceMessage(allowance),
    href: canManageBilling ? "/settings/billing" : null,
    label: monthly ? "Billing" : "Upgrade",
  }
}

export function assistantUsageMeter(tokensUsed: number, allowance: AssistantAllowance) {
  const used = Math.max(0, tokensUsed)
  switch (allowance.kind) {
    case "trial":
      return meter(used, allowance.included, "trial")
    case "included":
      return meter(used, allowance.included, "month")
    case "spent":
      return meter(used, allowance.included, allowance.reset === "month" ? "month" : "trial")
    case "open":
    case "ended":
      return { used, included: null, percent: null, period: null }
    default: {
      const unreachable: never = allowance
      return unreachable
    }
  }
}

function meter(used: number, included: number, period: "trial" | "month") {
  return {
    used,
    included,
    percent: Math.min(100, Math.round((used / included) * 100)),
    period,
  }
}
