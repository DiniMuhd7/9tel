import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { PLANS, startCheckout, constructWebhookEvent, handleWebhookEvent } from "../services/payments/stripe";

const router = Router();

/** GET /api/billing/plans — public plan list for the Premium screen. */
router.get("/plans", async (_req: Request, res: Response) => {
  res.json(PLANS);
});

/** POST /api/billing/checkout — start a Stripe Checkout session. */
router.post("/checkout", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { planId } = req.body;
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  try {
    const result = await startCheckout(req.userId, planId);
    res.json(result);
  } catch (err) {
    res.status(501).json({ error: (err as Error).message });
  }
});

export default router;

/**
 * POST /api/billing/webhook handler — deliberately NOT part of the
 * router above, and NOT using express.json(). Stripe's signature
 * verification (constructWebhookEvent) is an HMAC over the RAW request
 * body; if this route runs behind the app-wide express.json() middleware
 * like every other route, the body arrives already parsed/re-serialized
 * and verification fails even for a genuinely valid request. index.ts
 * mounts this handler directly on `app`, with `express.raw()`, BEFORE
 * the global express.json() call — see the comment there.
 */
export async function webhookHandler(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"] as string | undefined;

  let event: Stripe.Event;
  try {
    // req.body is a raw Buffer here (see index.ts's express.raw()) —
    // constructWebhookEvent needs exactly that, not parsed JSON.
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    // Deliberately vague — don't tell a probing caller whether the
    // signature, timestamp, or secret was the specific problem.
    return res.status(401).json({ error: "Invalid signature" });
  }

  try {
    await handleWebhookEvent(event);
    res.sendStatus(200);
  } catch (err) {
    console.error("Billing webhook error:", (err as Error).message);
    // 400, not 500: from Stripe's perspective this usually means a
    // malformed/unexpected event shape (e.g. missing metadata) rather
    // than a transient server failure — Stripe retries on 5xx, which
    // won't fix a metadata problem no matter how many times it's sent.
    res.sendStatus(400);
  }
}
