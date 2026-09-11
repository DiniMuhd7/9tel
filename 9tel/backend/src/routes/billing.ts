import { Router, Request, Response } from "express";
import { PLANS, startCheckout } from "../services/payments/flutterwave";

const router = Router();

/** GET /api/billing/plans — public plan list for the Premium screen. */
router.get("/plans", async (_req: Request, res: Response) => {
  res.json(PLANS);
});

/** POST /api/billing/checkout — start a checkout session with the billing processor. */
router.post("/checkout", async (req: Request, res: Response) => {
  const { planId } = req.body;
  try {
    const result = await startCheckout("todo-user-id", planId);
    res.json(result);
  } catch (err) {
    res.status(501).json({ error: "Checkout not implemented yet" });
  }
});

/** POST /api/billing/webhook — payment processor webhook. */
router.post("/webhook", async (_req: Request, res: Response) => {
  // TODO: verify signature and call handleWebhook from the payments service.
  res.sendStatus(200);
});

export default router;
