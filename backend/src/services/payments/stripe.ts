import Stripe from "stripe";
import { prisma } from "../../db/client";

/**
 * Committing to Stripe here, resolving a tension flagged repeatedly
 * earlier in this project's history: pricing, numbers, and Voice SDK
 * routing all ended up built around a US-first model (USD pricing,
 * US/CA/GB toll-free, PSTN-vs-Client split at the same three countries),
 * and Stripe is the natural fit for that — proper US tax handling, ACH,
 * and subscription lifecycle tooling that Flutterwave (Africa-first)
 * doesn't prioritize. If 9tel ever launches Flutterwave-appropriate
 * markets as a first-class target, this file is the one to swap or
 * branch, not routes/billing.ts.
 */

let cachedClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (cachedClient) return cachedClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe isn't configured — set STRIPE_SECRET_KEY.");
  cachedClient = new Stripe(secretKey);
  return cachedClient;
}

export interface PlanDefinition {
  id: "free" | "premium" | "business";
  name: string;
  priceLabel: string;
  monthlyMinutes: number;
  /** Max inbound 9tel numbers a single account may hold. Free/Premium are hard-capped at 1 in routes/numbers.ts. */
  maxNumbers: number;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0/month",
    monthlyMinutes: 15,
    maxNumbers: 1,
    features: [
      "1 9tel number",
      "Call forwarding",
      "Ads before calls",
      "Basic call history",
      "15 minutes/month",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    priceLabel: "$9.99/month",
    monthlyMinutes: 500,
    maxNumbers: 1,
    features: [
      "Ad-free calls",
      "Call forwarding",
      "Call history",
      "500 minutes/month",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Business",
    // Fixed, not a range — see the note below on what "feature-gated"
    // actually means here.
    priceLabel: "$29.99/month",
    monthlyMinutes: 2000,
    maxNumbers: Number(process.env.BUSINESS_MAX_NUMBERS ?? 3),
    features: [
      `Up to ${Number(process.env.BUSINESS_MAX_NUMBERS ?? 3)} 9tel numbers`,
      "2,000 minutes/month",
      "Call history across all numbers",
      "Priority support",
    ],
  },
];

/**
 * Maps a plan id to a Stripe Price ID (created in the Stripe Dashboard
 * as a recurring monthly price). Free has no Stripe price at all since
 * it's never checked out.
 */
function stripePriceIdForPlan(planId: string): string {
  const envKey = planId === "premium" ? "STRIPE_PRICE_PREMIUM" : planId === "business" ? "STRIPE_PRICE_BUSINESS" : null;
  const priceId = envKey ? process.env[envKey] : undefined;
  if (!priceId) throw new Error(`No Stripe price configured for plan "${planId}" (checked ${envKey}).`);
  return priceId;
}

/**
 * Creates a Stripe Checkout Session for a subscription. `userId`/`planId`
 * go in `metadata` — the webhook below reads them back from there to
 * know who to upgrade and to what, since Stripe has no other reliable
 * link back to a 9tel user.
 *
 * success_url/cancel_url point at the mobile app's own deep-link scheme
 * (see app.json's `scheme: "9tel"`) so the app can resume — see mobile's
 * app/checkout-callback.tsx — once Stripe redirects back after payment.
 */
export async function startCheckout(userId: string, planId: string): Promise<{ checkoutUrl: string }> {
  const stripe = getStripeClient();
  const priceId = stripePriceIdForPlan(planId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId, planId },
    // Stripe also needs metadata on the subscription itself for
    // subscription-lifecycle events (e.g. cancellation) further down —
    // checkout.session.completed's metadata alone doesn't carry through
    // to those.
    subscription_data: { metadata: { userId, planId } },
    success_url: "9tel://checkout-callback?status=success&planId=" + planId,
    cancel_url: "9tel://checkout-callback?status=cancel",
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { checkoutUrl: session.url };
}

/**
 * Verifies a webhook request actually came from Stripe. Unlike
 * Flutterwave's simple header-equality check, this is an HMAC-SHA256
 * over the RAW request body plus a timestamp — it needs the unparsed
 * body, which is why routes/billing.ts's webhook route uses
 * `express.raw()` instead of the app-wide `express.json()` (see
 * index.ts). Passing an already-JSON-parsed body here will fail
 * signature verification even with a genuinely valid request.
 */
export function constructWebhookEvent(rawBody: Buffer, signatureHeader: string | undefined): Stripe.Event {
  const stripe = getStripeClient();
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) throw new Error("STRIPE_WEBHOOK_SECRET isn't set — can't verify webhook signatures.");
  if (!signatureHeader) throw new Error("Missing Stripe-Signature header.");
  // Throws Stripe.errors.StripeSignatureVerificationError on a bad
  // signature — routes/billing.ts treats that as an auth failure (401),
  // not a generic 400.
  return stripe.webhooks.constructEvent(rawBody, signatureHeader, endpointSecret);
}

/**
 * Applies a verified Stripe event. Only called AFTER
 * constructWebhookEvent() has confirmed the request's signature —
 * this function trusts its input completely, so never call it with an
 * unverified payload.
 */
export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { userId, planId } = session.metadata ?? {};
      if (!userId || !planId) {
        throw new Error("checkout.session.completed missing metadata.userId/planId — was startCheckout's metadata set correctly?");
      }
      await prisma.user.update({ where: { id: userId }, data: { subscriptionTier: planId as "premium" | "business" } });
      // A user moving off Free should also move off the shared extension
      // and onto a dedicated number — that's a country-selection step
      // already known (user.country is required before Free-tier
      // provisioning even happens, see routes/numbers.ts), so mobile
      // calls POST /api/numbers/upgrade-to-dedicated itself once
      // checkout-callback confirms success, rather than guessing here.
      break;
    }

    case "customer.subscription.deleted": {
      // Subscription canceled or payment ultimately failed past Stripe's
      // retry schedule — downgrade back to Free. This does NOT
      // automatically move the person's number/extension back to the
      // shared toll-free number; that's a separate, more disruptive
      // step (it changes their public-facing number) worth a deliberate
      // "your Premium number will stop working" notice rather than doing
      // it silently inside a webhook handler.
      const subscription = event.data.object as Stripe.Subscription;
      const { userId } = subscription.metadata ?? {};
      if (userId) {
        await prisma.user.update({ where: { id: userId }, data: { subscriptionTier: "free" } });
      }
      break;
    }

    default:
      // Not every Stripe event type is relevant here — ignore anything
      // else rather than treating it as an error.
      break;
  }
}
