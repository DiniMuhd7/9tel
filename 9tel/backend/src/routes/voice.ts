import { Router, Request, Response } from "express";
import { TwilioProvider } from "../services/telephony/TwilioProvider";

const router = Router();
const telephony = new TwilioProvider();

/**
 * POST /api/voice/incoming
 * Twilio webhook fired when a caller dials a 9tel number.
 */
router.post("/incoming", async (req: Request, res: Response) => {
  const toNumber = req.body.To as string; // the 9tel number that was dialed
  const fromNumber = req.body.From as string;
  const callSid = req.body.CallSid as string;

  // TODO: look up the 9tel number -> user -> subscriptionTier ->
  // destinationE164 in Postgres. Placeholder values below.
  const resolved = {
    destinationE164: "+2348000000000",
    subscriptionTier: "free" as "free" | "premium" | "business",
    destinationVerified: true,
  };

  if (!resolved.destinationVerified) {
    res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not yet set up to receive calls.</Say></Response>`
    );
    return;
  }

  const twiml = telephony.buildIncomingCallResponse({
    destinationE164: resolved.destinationE164,
    playAd: resolved.subscriptionTier === "free",
  });

  res.type("text/xml").send(twiml);
});

/**
 * POST /api/voice/status
 * Twilio call-status callback — used to record call history and enforce
 * monthly minute limits.
 */
router.post("/status", async (req: Request, res: Response) => {
  // TODO: persist CallRecord (duration, status) and decrement the user's
  // remaining monthly minutes.
  res.sendStatus(200);
});

export default router;
