"use client"

import { useState } from "react"
import { format, parseISO } from "date-fns"
import { Check, Info } from "lucide-react"
import Link from "next/link"

import { ActionForm } from "@/components/action-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/format-date"
import { assistantUsageMeter, type AssistantAllowance } from "@/modules/assistant/allowance"
import {
  planAmount,
  planLabel,
  type BillingPlan,
} from "@/modules/billing/access"
import {
  openBillingPortalAction,
  startCheckoutAction,
} from "@/modules/billing/actions"

const plans: BillingPlan[] = ["staff", "registered"]

function planFeatures(plan: BillingPlan) {
  switch (plan) {
    case "staff":
      return [
        "Workers, documents, and approvals",
        "Dashboard",
      ]
    case "registered":
      return [
        "Everything in Staff",
        "Policies and participants",
        "Evidence packs and the activity log",
        "Automatic emails",
      ]
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

function money(amount: number) {
  return `$${amount.toFixed(2)}`
}

function periodDate(value: string) {
  const date = parseISO(value)
  if (Number.isNaN(date.getTime())) return formatDate(value)
  return format(date, "MMMM do, yyyy")
}

function PlanMark() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 1.4 14.2 5 8 8.6 1.8 5 8 1.4Zm0 8.3 6.2-3.6v1.7L8 11.4 1.8 7.8V6.1L8 9.7Zm0 3.1 6.2-3.6v1.7L8 14.5 1.8 10.9V9.2L8 12.8Z"
        />
      </svg>
    </span>
  )
}

export function BillingSettings({
  organisationName,
  abn,
  email,
  activeWorkers,
  seats,
  plan,
  trialEndsAt,
  daysLeft,
  connected,
  hasCustomer,
  hasSubscription,
  checkout,
  assistantUsed,
  assistantAllowance,
}: {
  organisationName: string
  abn: string | null
  email: string
  activeWorkers: number
  seats: number
  plan: BillingPlan | null
  trialEndsAt: string | null
  daysLeft: number
  connected: boolean
  hasCustomer: boolean
  hasSubscription: boolean
  checkout?: string
  assistantUsed: number
  assistantAllowance: AssistantAllowance
}) {
  const [compareOpen, setCompareOpen] = useState(false)
  const [summaryPlan, setSummaryPlan] = useState<BillingPlan | null>(null)
  const onTrial = daysLeft > 0 && !hasSubscription
  const displayPlan: BillingPlan | null = plan ?? (onTrial ? "registered" : null)
  const used = Math.min(activeWorkers, seats)
  const seatPercent = seats === 0 ? 0 : Math.round((used / seats) * 100)
  const assistantMeter = assistantUsageMeter(assistantUsed, assistantAllowance)

  function openSummary(next: BillingPlan) {
    setCompareOpen(false)
    setSummaryPlan(next)
  }

  const summaryAmount = summaryPlan ? planAmount(summaryPlan) * seats : 0
  const dueToday = onTrial ? 0 : summaryAmount

  return (
    <div className="grid gap-10">
      {checkout === "success" ? (
        <p className="text-sm text-muted-foreground">
          Stripe is confirming the subscription. This page updates when it is
          recorded.
        </p>
      ) : null}
      {checkout === "cancel" ? (
        <p className="text-sm text-muted-foreground">
          Checkout was cancelled. No charge was made.
        </p>
      ) : null}
      {onTrial ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2">
          <p className="flex items-center gap-2 text-sm">
            <Info className="size-4 text-muted-foreground" />
            There {daysLeft === 1 ? "is" : "are"} {daysLeft}{" "}
            {daysLeft === 1 ? "day" : "days"} left on your trial
          </p>
          <Button
            size="sm"
            onClick={() => openSummary(displayPlan ?? "registered")}
          >
            Add billing details
          </Button>
        </div>
      ) : null}

      <section className="grid gap-4">
        <h2 className="text-base font-medium">Plan</h2>
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <PlanMark />
              <span className="text-sm font-medium">
                {displayPlan ? planLabel(displayPlan) : "No plan"}
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Monthly
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {displayPlan
                ? `${money(planAmount(displayPlan))} per worker/month`
                : "Choose a plan to continue after the trial."}
            </p>
            <Button
              size="sm"
              className="w-fit"
              onClick={() => setCompareOpen(true)}
            >
              Explore Plans
            </Button>
          </div>
          <div className="grid gap-1 text-sm">
            <p className="text-muted-foreground">Billing period</p>
            <p>
              Monthly
              {onTrial && trialEndsAt ? ` (starts ${periodDate(trialEndsAt)})` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 className="text-base font-medium">Usage</h2>
        <div className="grid gap-3 rounded-xl border px-4 py-3.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-medium">Seats</p>
            <p className="text-muted-foreground">
              {activeWorkers} used / {seats} included
            </p>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#f5a524]"
              style={{ width: `${seatPercent}%` }}
            />
          </div>
        </div>
        <div className="grid gap-3 rounded-xl border px-4 py-3.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-medium">Assistant</p>
            <p className="text-muted-foreground">
              {assistantMeter.percent === null ? "Included with the plan" : `${assistantMeter.percent}%`}
            </p>
          </div>
          {assistantMeter.percent !== null ? (
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[#f5a524]"
                style={{ width: `${assistantMeter.percent}%` }}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-base font-medium">Billing Details</h2>
        <div className="grid gap-8 sm:grid-cols-2">
          <dl className="grid content-start gap-4 text-sm">
            <div className="grid gap-1">
              <dt className="text-muted-foreground">Billing Email</dt>
              <dd>{email}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-muted-foreground">Company Name</dt>
              <dd>{organisationName}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="text-muted-foreground">ABN</dt>
              <dd>{abn?.trim() ? abn : "Not provided"}</dd>
            </div>
            <Link href="/settings/general" className="w-fit text-primary hover:underline">
              Update billing details
            </Link>
          </dl>
          <dl className="grid content-start gap-1 text-sm">
            <dt className="text-muted-foreground">Payment Methods</dt>
            <dd>
              {hasCustomer ? (
                <ActionForm
                  bare
                  action={openBillingPortalAction}
                  submitLabel="Update payment method"
                  pendingLabel="Opening Stripe..."
                  submitVariant="link"
                  submitClassName="h-auto px-0"
                />
              ) : (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => openSummary(displayPlan ?? "registered")}
                >
                  Add payment method
                </button>
              )}
            </dd>
          </dl>
        </div>
        {!connected ? (
          <p className="text-sm text-muted-foreground">
            Stripe is not connected on this server yet. Plan changes open here,
            and checkout starts once STRIPE_SECRET_KEY is set.
          </p>
        ) : null}
      </section>

      <section className="grid gap-3">
        <h2 className="text-base font-medium">Invoices</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Reference</th>
              <th className="px-3 py-2 font-medium">Total incl. tax</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3 text-muted-foreground" colSpan={4}>
                No invoices yet
              </td>
            </tr>
          </tbody>
        </table>
        {hasSubscription ? (
          <ActionForm
            bare
            action={openBillingPortalAction}
            submitLabel="Cancel subscription"
            pendingLabel="Opening Stripe..."
            submitVariant="link"
            submitClassName="h-auto px-0 text-foreground"
          />
        ) : null}
      </section>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Compare plans</DialogTitle>
            <DialogDescription>
              Monthly billing, per active worker.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans.map((item) => {
              const current = item === displayPlan
              return (
                <section
                  key={item}
                  className="grid content-start gap-3 rounded-lg border p-4"
                >
                  <div className="flex items-center gap-2">
                    <PlanMark />
                    <div>
                      <h3 className="text-sm font-medium">{planLabel(item)}</h3>
                      <p className="text-sm text-muted-foreground">
                        {money(planAmount(item))} per worker/month
                      </p>
                    </div>
                  </div>
                  <ul className="grid gap-1.5 text-sm">
                    {planFeatures(item).map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 size-3.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant={current && hasSubscription ? "outline" : "default"}
                    disabled={current && hasSubscription}
                    onClick={() => openSummary(item)}
                  >
                    {current && hasSubscription
                      ? "Current plan"
                      : current
                        ? "Add billing details"
                        : item === "registered"
                          ? "Upgrade to Registered"
                          : "Switch to Staff"}
                  </Button>
                </section>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={summaryPlan !== null}
        onOpenChange={(open) => {
          if (!open) setSummaryPlan(null)
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Change summary</DialogTitle>
            <DialogDescription>
              {summaryPlan
                ? summaryPlan === displayPlan
                  ? `Continue with ${planLabel(summaryPlan)}`
                  : summaryPlan === "registered"
                    ? "Upgrade to Registered"
                    : "Switch to Staff"
                : "Review the plan"}
            </DialogDescription>
          </DialogHeader>
          {summaryPlan ? (
            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem]">
              <div className="grid gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <PlanMark />
                  <p className="font-medium">
                    {summaryPlan === displayPlan
                      ? planLabel(summaryPlan)
                      : summaryPlan === "registered"
                        ? "Upgrade to Registered"
                        : "Switch to Staff"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className="text-muted-foreground">Billing period</p>
                  <p>
                    Monthly · {money(planAmount(summaryPlan))} / worker / month
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className="text-muted-foreground">Seats</p>
                  <p>
                    {seats} {seats === 1 ? "seat" : "seats"} · {activeWorkers}{" "}
                    active {activeWorkers === 1 ? "worker" : "workers"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Seats cannot be set below your active workers.
                  </p>
                </div>
                <div className="grid gap-1">
                  <p className="text-muted-foreground">Billing information</p>
                  <p>{email}</p>
                  <p>{organisationName}</p>
                </div>
              </div>
              <div className="grid content-start gap-3 rounded-lg bg-muted/50 p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span>
                    {seats} × {planLabel(summaryPlan)}
                  </span>
                  <span>{money(summaryAmount)}</span>
                </div>
                <div className="flex justify-between gap-3 text-muted-foreground">
                  <span>Tax</span>
                  <span>{money(0)}</span>
                </div>
                <div className="flex justify-between gap-3 font-medium">
                  <span>Total at renewal</span>
                  <span>{money(summaryAmount)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Adjustment due today</span>
                  <span>{money(dueToday)}</span>
                </div>
                <ActionForm
                  action={startCheckoutAction}
                  submitLabel="Confirm and upgrade"
                  pendingLabel="Opening Stripe..."
                  fullWidth
                >
                  <input type="hidden" name="plan" value={summaryPlan} />
                </ActionForm>
                <p className="text-xs text-muted-foreground">
                  {onTrial && trialEndsAt
                    ? `Your card will not be charged until the end of the trial on ${formatDate(trialEndsAt)}.`
                    : "Your card will be charged when the subscription starts."}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
