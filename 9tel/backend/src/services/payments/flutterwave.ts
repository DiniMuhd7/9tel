/**
 * Billing service stub for Free/Premium/Business subscriptions.
 *
 * Pricing below is USD, sized against the US toll-free telephony cost
 * model (~$3.73/user/month at 45 min — see the revenue-feasibility
 * breakdown): Free is capped tight enough that ad revenue + minimal usage
 * doesn't run deeply negative, and Premium is priced with real margin
 * over cost rather than the original Naira pricing, which didn't clear
 * US per-minute costs.
 *
 * TODO: Flutterwave supports USD, but it's primarily built for
 * Africa-first billing. For a US-first launch, Stripe is the more
 * standard fit (ACH/card support, US tax handling, subscription
 * lifecycle tooling) — worth confirming which processor before wiring
 * this up for real. Interface below is processor-agnostic so swapping is
 * a service-level change, not an app-wide one.
 */
export interface PlanDefinition {
  id: "free" | "premium" | "business";
  name: string;
  priceLabel: string;
  monthlyMinutes: number;
  features: string[];
}

export const PLANS: PlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0/month",
    monthlyMinutes: 15,
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
    features: [
      "Ad-free calls",
      "Call forwarding",
      "Call history",
      "500 minutes/month",
      "Multiple forwarding numbers",
      "Call scheduling",
      "Priority support",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceLabel: "$19.99–$39.99/month",
    monthlyMinutes: 2000,
    features: [
      "Multiple numbers",
      "Multiple employees",
      "Business hours",
      "Call routing",
      "IVR",
      "Call analytics",
      "Team members",
    ],
  },
];

export async function startCheckout(userId: string, planId: string): Promise<{ checkoutUrl: string }> {
  // TODO: call the chosen processor's payment-initiation API, passing
  // planId's price, and return the hosted checkout URL it gives back.
  throw new Error("Not implemented — wire up billing checkout.");
}

export async function handleWebhook(payload: unknown): Promise<void> {
  // TODO: verify the processor's webhook signature, then update the
  // user's subscriptionTier in the database on successful payment.
  throw new Error("Not implemented — wire up billing webhook handling.");
}
