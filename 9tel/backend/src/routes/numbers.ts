import { Router, Request, Response } from "express";
import { TwilioProvider } from "../services/telephony/TwilioProvider";

const router = Router();
const telephony = new TwilioProvider();

/** GET /api/numbers/me — the caller's assigned 9tel number. */
router.get("/me", async (req: Request, res: Response) => {
  // TODO: look up by authenticated user id (from JWT middleware).
  res.json({
    id: "todo",
    e164: "+15551234567",
    country: "US",
    numberType: "toll-free", // US/CA/GB provision toll-free by default — see TwilioProvider
    status: "active",
    destinationE164: null,
    destinationVerified: false,
  });
});

/**
 * POST /api/numbers/provision — provision a new 9tel number for the given
 * country. Picks toll-free automatically for US/CA/GB, local elsewhere —
 * see TwilioProvider.provisionNumber().
 */
router.post("/provision", async (req: Request, res: Response) => {
  const { countryCode } = req.body;
  try {
    const number = await telephony.provisionNumber(countryCode);
    res.json(number);
  } catch (err) {
    res.status(501).json({ error: (err as Error).message });
  }
});

/** PATCH /api/numbers/destination — set/update the forwarding number. */
router.patch("/destination", async (req: Request, res: Response) => {
  const { destinationE164 } = req.body;
  // TODO: save destination as unverified, trigger an SMS/call verification
  // code to destinationE164.
  res.json({
    id: "todo",
    e164: "+15551234567",
    country: "US",
    numberType: "toll-free",
    status: "active",
    destinationE164,
    destinationVerified: false,
  });
});

/** POST /api/numbers/destination/verify — confirm the verification code. */
router.post("/destination/verify", async (req: Request, res: Response) => {
  const { code } = req.body;
  // TODO: check code against what was sent, mark destinationVerified=true.
  res.json({ verified: true });
});

export default router;
