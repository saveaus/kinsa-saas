import { trialDaysRemaining, type BillingSnapshot } from "@/modules/billing/access"

export const TRIAL_ASSISTANT_TOKENS = 50_000

export type AssistantAllowance =
  | { kind: "open" }
  | { kind: "trial"; remaining: number }
  | { kind: "spent" }
  | { kind: "ended" }

export function assistantAllowance(input: {
  billing: BillingSnapshot
  tokensUsed: number
  now?: Date
  stripeConfigured?: boolean
}): AssistantAllowance {
  const now = input.now ?? new Date()
  if (input.stripeConfigured === false) return { kind: "open" }

  switch (input.billing.status) {
    case "active":
      return { kind: "open" }
    case "past_due":
      return { kind: "ended" }
    case "trialing":
    case null: {
      if (trialDaysRemaining(input.billing.trialEndsAt, now) <= 0) return { kind: "ended" }
      const remaining = TRIAL_ASSISTANT_TOKENS - Math.max(0, input.tokensUsed)
      if (remaining <= 0) return { kind: "spent" }
      return { kind: "trial", remaining }
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

export function assistantAllowanceMessage(kind: "spent" | "ended") {
  switch (kind) {
    case "spent":
      return `The free trial includes ${TRIAL_ASSISTANT_TOKENS.toLocaleString("en-AU")} assistant tokens. That allowance is used. Add a plan to keep going.`
    case "ended":
      return "Add a plan to keep using the assistant."
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

export function assistantUsageMeter(
  tokensUsed: number,
  allowance: AssistantAllowance
) {
  const used = Math.max(0, tokensUsed)
  switch (allowance.kind) {
    case "trial":
    case "spent":
      return {
        used,
        included: TRIAL_ASSISTANT_TOKENS,
        percent: Math.min(100, Math.round((used / TRIAL_ASSISTANT_TOKENS) * 100)),
      }
    case "open":
    case "ended":
      return { used, included: null, percent: null }
    default: {
      const unreachable: never = allowance
      return unreachable
    }
  }
}

