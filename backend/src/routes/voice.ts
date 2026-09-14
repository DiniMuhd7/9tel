import { Router, Request, Response } from "express";
import { TwilioProvider } from "../services/telephony/TwilioProvider";
import { CallDestination } from "../services/telephony/TelephonyProvider";
import { SHARED_TOLLFREE_NUMBER, EXTENSION_DIGITS } from "../services/telephony/sharedExtension";
import { generateVoiceAccessToken, clientIdentityForUser } from "../services/telephony/voiceToken";
import { prisma } from "../db/client";
import { hasMinutesRemaining } from "../services/usage";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();
const telephony = new TwilioProvider();

const OUT_OF_MINUTES_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>This user has used all of their minutes for this month. Please try again later.</Say></Response>`;

const NOT_SET_UP_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response><Say>This number is not yet set up to receive calls.</Say></Response>`;

/**
 * Resolves a NineTelNumber row to a TwiML response: checks destination
 * readiness and remaining monthly minutes before dialing. Delivery
 * branches on destinationType:
 *  - "pstn": dials the verified destinationE164, as before.
 *  - "client": delivers over WebRTC to the user's Voice SDK Client
 *    identity — no PSTN leg, no verification step (it's auto-configured
 *    at provision time, see routes/numbers.ts).
 *
 * The dial's `action` URL carries `numberId` as a query param so /status
 * can attribute the completed call unambiguously — required for the
 * shared toll-free number, since the dialed-to number alone doesn't
 * identify which user's call this was.
 */
async function respondForNumber(
  number: {
    id: string;
    userId: string;
    destinationType: string;
    destinationE164: string | null;
    destinationVerified: boolean;
    clientIdentity: string | null;
  },
  callerNumber: string | undefined,
  res: Response
) {
  let destination: CallDestination;
  if (number.destinationType === "client") {
    if (!number.clientIdentity) {
      res.type("text/xml").send(NOT_SET_UP_TWIML);
      return;
    }
    destination = { type: "client", identity: number.clientIdentity };
  } else {
    if (!number.destinationE164 || !number.destinationVerified) {
      res.type("text/xml").send(NOT_SET_UP_TWIML);
      return;
    }
    destination = { type: "pstn", e164: number.destinationE164 };
  }

  const user = await prisma.user.findUnique({ where: { id: number.userId } });
  if (!user) {
    res.type("text/xml").send(NOT_SET_UP_TWIML);
    return;
  }

  const { allowed } = await hasMinutesRemaining(user.id, user.subscriptionTier);
  if (!allowed) {
    res.type("text/xml").send(OUT_OF_MINUTES_TWIML);
    return;
  }

  const twiml = telephony.buildIncomingCallResponse({
    destination,
    playAd: user.subscriptionTier === "free",
    statusCallbackUrl: `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/voice/status?numberId=${number.id}`,
    callerNumber,
  });
  res.type("text/xml").send(twiml);
}

/**
 * POST /api/voice/incoming
 * Twilio webhook fired when a caller dials a 9tel number.
 *
 * Two paths depending on what was dialed:
 *  - A dedicated Premium/Business number → resolve directly and dial.
 *  - The shared Free-tier toll-free number → prompt for an extension
 *    instead (see /extension below for what happens after they enter it).
 */
router.post("/incoming", async (req: Request, res: Response) => {
  const toNumber = req.body.To as string; // the 9tel number that was dialed

  if (toNumber === SHARED_TOLLFREE_NUMBER) {
    const twiml = telephony.buildExtensionPromptResponse({
      gatherActionUrl: `${process.env.TWILIO_WEBHOOK_BASE_URL}/api/voice/extension`,
      extensionDigits: EXTENSION_DIGITS,
    });
    res.type("text/xml").send(twiml);
    return;
  }

  const number = await prisma.nineTelNumber.findFirst({ where: { e164: toNumber, extension: null } });
  if (!number) {
    res.type("text/xml").send(NOT_SET_UP_TWIML);
    return;
  }

  await respondForNumber(number, req.body.From as string | undefined, res);
});

/**
 * POST /api/voice/extension
 * <Gather> action callback from the shared-number prompt above. `Digits`
 * holds what the caller typed before the `#`.
 */
router.post("/extension", async (req: Request, res: Response) => {
  const digits = req.body.Digits as string | undefined;
  if (!digits) {
    res.type("text/xml").send(telephony.buildExtensionNotFoundResponse());
    return;
  }

  const number = await prisma.nineTelNumber.findFirst({
    where: { e164: SHARED_TOLLFREE_NUMBER, extension: digits },
  });

  if (!number) {
    res.type("text/xml").send(telephony.buildExtensionNotFoundResponse());
    return;
  }

  await respondForNumber(number, req.body.From as string | undefined, res);
});

/**
 * POST /api/voice/status
 * <Dial action> callback — fires once the dialed leg completes, carrying
 * DialCallStatus/DialCallDuration plus the `numberId` query param set in
 * respondForNumber(). Records the call and, by extension, feeds the
 * minute-cap check on the next incoming call.
 */
router.post("/status", async (req: Request, res: Response) => {
  const { CallSid, From, DialCallStatus, DialCallDuration } = req.body as {
    CallSid?: string;
    From?: string;
    DialCallStatus?: string; // completed, no-answer, busy, failed...
    DialCallDuration?: string; // seconds
  };
  const numberId = req.query.numberId as string | undefined;

  if (!CallSid || !numberId) return res.sendStatus(200);

  const number = await prisma.nineTelNumber.findUnique({ where: { id: numberId } });
  if (!number) return res.sendStatus(200);

  const status = DialCallStatus === "completed" ? "answered" : DialCallStatus === "no-answer" ? "missed" : "failed";

  await prisma.callRecord.upsert({
    where: { providerCallSid: CallSid },
    update: { durationSeconds: Number(DialCallDuration ?? 0), status },
    create: {
      userId: number.userId,
      ninetelNumberId: number.id,
      providerCallSid: CallSid,
      callerNumber: From ?? "unknown",
      destinationNumber: number.destinationE164 ?? number.clientIdentity ?? "unknown",
      startedAt: new Date(),
      durationSeconds: Number(DialCallDuration ?? 0),
      status,
    },
  });

  // TwiML expected in response since this is a <Dial action> callback,
  // not a plain statusCallback — an empty <Response/> just ends the call
  // flow normally without further instructions.
  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
});

/**
 * GET /api/voice/token — issues a Twilio Voice SDK Access Token for the
 * caller's OWN client identity, so the mobile app can register and
 * receive calls delivered via <Dial><Client>...</Client></Dial>. Only
 * meaningful for accounts with destinationType "client" (see
 * routes/numbers.ts), but harmless to call regardless — the identity is
 * deterministic from the user id either way.
 */
router.get("/token", requireAuth, async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  const identity = clientIdentityForUser(req.userId);
  try {
    const token = generateVoiceAccessToken(identity);
    res.json({ token, identity });
  } catch (err) {
    res.status(501).json({ error: (err as Error).message });
  }
});

export default router;
