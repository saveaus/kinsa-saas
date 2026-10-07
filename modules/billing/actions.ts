"use server"

import { redirect } from "next/navigation"

import { requestAppUrl } from "@/lib/request-app-url"
import { requirePermission, requireTenant } from "@/lib/tenant"
import { isBillingPlan, trialDaysRemaining } from "@/modules/billing/access"
import {
  countActiveWorkers,
  getOrganisationBilling,
} from "@/modules/billing/queries"
import {
  checkoutUrl,
  portalUrl,
  stripeConfigured,
} from "@/modules/billing/stripe"

export type BillingActionState = { error?: string }

export async function startCheckoutAction(
  _prev: BillingActionState,
  formData: FormData
): Promise<BillingActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  if (!stripeConfigured()) {
    return { error: "Stripe is not connected on this server yet." }
  }

  const plan = formData.get("plan")
  if (!isBillingPlan(plan)) return { error: "Choose a plan." }

  const billing = await getOrganisationBilling(context.organisationId)
  if (billing.stripeSubscriptionId) {
    if (!billing.stripeCustomerId) {
      return { error: "This subscription has no Stripe customer yet." }
    }
    redirect(
      await portalUrl({
        customerId: billing.stripeCustomerId,
        origin: await requestAppUrl(),
      })
    )
  }

  const seats = await countActiveWorkers(context.organisationId)
  const url = await checkoutUrl({
    organisationId: context.organisationId,
    organisationName: context.organisationName,
    email: context.email,
    plan,
    quantity: seats,
    trialDays:
      billing.plan === null ? trialDaysRemaining(billing.trialEndsAt) : 0,
    customerId: billing.stripeCustomerId,
    origin: await requestAppUrl(),
  })
  redirect(url)
}

export async function openBillingPortalAction(
  _prev: BillingActionState,
  _formData: FormData
): Promise<BillingActionState> {
  const { context } = await requireTenant()
  requirePermission(context, "settings.manage")
  if (!stripeConfigured()) {
    return { error: "Stripe is not connected on this server yet." }
  }

  const billing = await getOrganisationBilling(context.organisationId)
  if (!billing.stripeCustomerId) {
    return { error: "Start a subscription before managing the card." }
  }

  redirect(
    await portalUrl({
      customerId: billing.stripeCustomerId,
      origin: await requestAppUrl(),
    })
  )
}
