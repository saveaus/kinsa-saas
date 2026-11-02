// Moves live subscriptions off retired per-worker prices onto the current ones.
// Dry run by default. Needs STRIPE_SECRET_KEY in the environment.
//
//   node scripts/migrate-subscription-prices.mjs            lists what would change
//   node scripts/migrate-subscription-prices.mjs --apply    makes the changes
//
// The new price applies from each customer's next invoice, with no proration.
// Tell customers before applying: this changes what they are charged.
import Stripe from "stripe"

const AMOUNTS = { staff: 800, registered: 1200 }
const LOOKUP = {
  staff: "kinsa_staff_monthly",
  registered: "kinsa_registered_monthly",
}

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error("Set STRIPE_SECRET_KEY first.")
  process.exit(1)
}
const apply = process.argv.includes("--apply")
const stripe = new Stripe(key)

async function currentPrice(plan) {
  const { data } = await stripe.prices.list({
    active: true,
    limit: 1,
    lookup_keys: [LOOKUP[plan]],
  })
  const match = data.find(
    (price) =>
      price.unit_amount === AMOUNTS[plan] &&
      price.currency === "aud" &&
      price.recurring?.interval === "month"
  )
  if (!match) throw new Error(`No current ${plan} price. Open checkout once to create it.`)
  return match
}

const prices = {
  staff: await currentPrice("staff"),
  registered: await currentPrice("registered"),
}

let total = 0
let outdated = 0
for await (const subscription of stripe.subscriptions.list({ status: "all", limit: 100 })) {
  if (["canceled", "incomplete_expired"].includes(subscription.status)) continue
  total += 1
  const item = subscription.items.data[0]
  const plan = item?.price?.metadata?.plan ?? subscription.metadata?.plan
  const target = prices[plan]
  if (!item || !target) {
    console.log(`SKIP ${subscription.id}: unknown plan "${plan}"`)
    continue
  }
  if (item.price.id === target.id) continue
  outdated += 1
  console.log(
    `${apply ? "MOVE" : "WOULD MOVE"} ${subscription.id} org=${subscription.metadata?.organisationId ?? "?"} ` +
      `${plan} x${item.quantity}: ${item.price.unit_amount} -> ${target.unit_amount} cents`
  )
  if (apply) {
    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: target.id, quantity: item.quantity }],
      proration_behavior: "none",
    })
  }
}
console.log(`${total} live subscriptions, ${outdated} on an old price.${apply ? "" : " Dry run: nothing changed."}`)
