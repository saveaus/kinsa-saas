import { NextResponse } from "next/server"
import type Stripe from "stripe"

import { applySubscription, stripeClient } from "@/modules/billing/stripe"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const stripe = stripeClient()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 501 }
    )
  }

  const signature = request.headers.get("stripe-signature")
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 })
  }

  const body = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret)
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 })
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      if (session.mode !== "subscription" || !session.subscription) break
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      await applySubscription(
        subscription,
        session.client_reference_id ?? session.metadata?.organisationId
      )
      break
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object
      await applySubscription(
        subscription,
        subscription.metadata.organisationId
      )
      break
    }
    default:
      break
  }

  return NextResponse.json({ received: true })
}
