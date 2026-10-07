import Stripe from "stripe"

import { createAdminSupabase } from "@/lib/supabase/admin"
import {
  billedSeats,
  isBillingPlan,
  type BillingPlan,
  type BillingStatus,
} from "@/modules/billing/access"

const LOOKUP = {
  staff: "kinsa_staff_monthly",
  registered: "kinsa_registered_monthly",
} as const

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  return new Stripe(key)
}

function planAmountCents(plan: BillingPlan) {
  switch (plan) {
    case "staff":
      return 1200
    case "registered":
      return 1500
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

function planProductName(plan: BillingPlan) {
  switch (plan) {
    case "staff":
      return "Kinsa Staff"
    case "registered":
      return "Kinsa Registered"
    default: {
      const unreachable: never = plan
      return unreachable
    }
  }
}

export async function ensurePlanPrice(stripe: Stripe, plan: BillingPlan) {
  const lookupKey = LOOKUP[plan]
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  })
  const current = existing.data[0]
  if (current?.id && typeof current.product === "string") {
    return { priceId: current.id, productId: current.product }
  }

  const product = await stripe.products.create({
    name: planProductName(plan),
    metadata: { plan },
  })
  const price = await stripe.prices.create({
    product: product.id,
    currency: "aud",
    unit_amount: planAmountCents(plan),
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    metadata: { plan },
  })
  return { priceId: price.id, productId: product.id }
}

export async function checkoutUrl(input: {
  organisationId: string
  organisationName: string
  email: string
  plan: BillingPlan
  quantity: number
  trialDays: number
  customerId: string | null
  origin: string
}) {
  const stripe = stripeClient()
  if (!stripe) throw new Error("Stripe is not connected on this server yet.")

  const { priceId } = await ensurePlanPrice(stripe, input.plan)
  let customerId = input.customerId
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: input.organisationName,
      email: input.email,
      metadata: { organisationId: input.organisationId },
    })
    customerId = customer.id
    const admin = createAdminSupabase()
    const { error } = await admin
      .from("organisations")
      .update({ stripe_customer_id: customerId })
      .eq("id", input.organisationId)
    if (error) throw new Error(error.message)
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.organisationId,
    line_items: [{ price: priceId, quantity: billedSeats(input.quantity) }],
    subscription_data: {
      metadata: { organisationId: input.organisationId, plan: input.plan },
      ...(input.trialDays > 0 ? { trial_period_days: input.trialDays } : {}),
    },
    success_url: `${input.origin}/settings/billing?checkout=success`,
    cancel_url: `${input.origin}/settings/billing?checkout=cancel`,
  })

  if (!session.url) throw new Error("Stripe did not return a checkout link.")
  return session.url
}

async function portalConfiguration(stripe: Stripe) {
  const listed = await stripe.billingPortal.configurations.list({
    active: true,
    limit: 10,
  })
  const existing = listed.data.find(
    (item) => item.metadata?.kinsa === "billing"
  )
  if (existing) return existing.id

  const [staff, registered] = await Promise.all([
    ensurePlanPrice(stripe, "staff"),
    ensurePlanPrice(stripe, "registered"),
  ])

  const created = await stripe.billingPortal.configurations.create({
    metadata: { kinsa: "billing" },
    business_profile: {
      headline: "Manage the Kinsa subscription",
    },
    features: {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products: [
          { product: staff.productId, prices: [staff.priceId] },
          { product: registered.productId, prices: [registered.priceId] },
        ],
      },
    },
  })
  return created.id
}

export async function portalUrl(input: { customerId: string; origin: string }) {
  const stripe = stripeClient()
  if (!stripe) throw new Error("Stripe is not connected on this server yet.")
  const configuration = await portalConfiguration(stripe)
  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: `${input.origin}/settings/billing`,
    configuration,
  })
  return session.url
}

export function mapStripeStatus(
  status: Stripe.Subscription.Status
): BillingStatus {
  switch (status) {
    case "trialing":
      return "trialing"
    case "active":
      return "active"
    case "past_due":
    case "unpaid":
      return "past_due"
    case "canceled":
    case "incomplete_expired":
      return "canceled"
    case "incomplete":
      return "incomplete"
    case "paused":
      return "paused"
    default:
      return "incomplete"
  }
}

export function planFromSubscription(subscription: Stripe.Subscription) {
  const price = subscription.items.data[0]?.price
  const lookup = price?.lookup_key
  if (lookup === LOOKUP.staff) return "staff" as const
  if (lookup === LOOKUP.registered) return "registered" as const
  const metadataPlan = price?.metadata?.plan ?? subscription.metadata.plan
  return isBillingPlan(metadataPlan) ? metadataPlan : null
}

export async function syncSubscriptionSeats(organisationId: string) {
  const stripe = stripeClient()
  if (!stripe) return

  try {
    const admin = createAdminSupabase()
    const [{ count, error: countError }, organisation] = await Promise.all([
      admin
        .from("workers")
        .select("id", { count: "exact", head: true })
        .eq("organisation_id", organisationId)
        .eq("employment_status", "active")
        .is("deleted_at", null),
      admin
        .from("organisations")
        .select("stripe_subscription_id")
        .eq("id", organisationId)
        .maybeSingle(),
    ])
    if (countError) throw new Error(countError.message)
    const subscriptionId = organisation.data?.stripe_subscription_id
    if (!subscriptionId) return

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const item = subscription.items.data[0]
    const quantity = billedSeats(count ?? 0)
    if (!item || item.quantity === quantity) return

    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, quantity }],
      proration_behavior: "create_prorations",
    })
  } catch (error) {
    console.error("billing seats", error)
  }
}

export async function applySubscription(
  subscription: Stripe.Subscription,
  organisationId?: string | null
) {
  const admin = createAdminSupabase()
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id
  const plan = planFromSubscription(subscription)
  const status = mapStripeStatus(subscription.status)
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toISOString()
    : null

  let update = admin
    .from("organisations")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      billing_plan: plan,
      billing_status: status,
      ...(trialEndsAt ? { trial_ends_at: trialEndsAt } : {}),
    })
    .select("id")

  update = organisationId
    ? update.eq("id", organisationId)
    : update.eq("stripe_customer_id", customerId)

  const { data, error } = await update.maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return

  await admin.from("audit_events").insert({
    organisation_id: data.id,
    action: "billing.updated",
    target_type: "organisation",
    target_id: data.id,
    metadata: { plan, status },
  })
}
