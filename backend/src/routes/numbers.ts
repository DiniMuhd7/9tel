import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { AuthedRequest } from "../middleware/auth";
import { prisma } from "../db/client";
import { TwilioProvider } from "../services/telephony/TwilioProvider";
import { assignExtension, SHARED_TOLLFREE_NUMBER } from "../services/telephony/sharedExtension";
import { usesPstnDestination } from "../services/telephony/coverage";
import { clientIdentityForUser } from "../services/telephony/voiceToken";
import { sendSms } from "../services/sms";
import { PLANS } from "../services/payments/stripe";

const router = Router();
const telephony = new TwilioProvider();

const DESTINATION_OTP_LENGTH = 6;
const DESTINATION_OTP_TTL_MINUTES = 10;

function maxNumbersForTier(tier: string): number {
  return PLANS.find((p) => p.id === tier)?.maxNumbers ?? 1;
}

/** GET /api/numbers/me — the caller's PRIMARY 9tel number (first provisioned). Free/Premium only ever have one. */
router.get("/me", async (req: AuthedRequest, res: Response) => {
  const number = await prisma.nineTelNumber.findFirst({ where: { userId: req.userId }, orderBy: { createdAt: "asc" } });
  if (!number) return res.status(404).json({ error: "No number provisioned yet" });
  res.json(toApiShape(number));
});

/**
 * GET /api/numbers — ALL of the caller's numbers. Free/Premium accounts
 * will only ever see one (enforced at provision time below); this
 * exists for Business accounts, which can hold more than one — see
 * PLANS[].maxNumbers in services/payments/stripe.ts.
 */
router.get("/", async (req: AuthedRequest, res: Response) => {
  const numbers = await prisma.nineTelNumber.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
  });
  res.json(numbers.map(toApiShape));
});

/**
 * POST /api/numbers/provision — assign a NEW 9tel number, using the
 * CALLER'S ACTUAL subscriptionTier and country (both looked up
 * server-side, not client-supplied) to decide:
 *  - inbound number type: free → shared toll-free + extension;
 *    premium/business → dedicated (toll-free for US/CA/GB, local
 *    elsewhere) via TwilioProvider.
 *  - delivery/destination type: US/CA/GB → PSTN (the person sets a
 *    destination phone number via PATCH /:numberId/destination);
 *    everywhere else → in-app Voice SDK Client, auto-configured here.
 *
 * How many numbers an account may hold is capped by its plan
 * (PLANS[].maxNumbers) — Free and Premium are both capped at 1, so this
 * behaves exactly as before for them; Business can hold more, which is
 * the actual "feature-gating" this enables rather than just a higher
 * price.
 *
 * Requires country to already be set (via PATCH /api/auth/country).
 */
router.post("/provision", async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Unauthenticated" });
  if (!user.country) {
    return res.status(400).json({ error: "Set a country first via PATCH /api/auth/country" });
  }

  const existingCount = await prisma.nineTelNumber.count({ where: { userId: req.userId } });
  const limit = maxNumbersForTier(user.subscriptionTier);
  if (existingCount >= limit) {
    return res.status(409).json({
      error:
        existingCount === 1 && limit === 1
          ? "User already has a number provisioned"
          : `This plan allows up to ${limit} numbers — you already have ${existingCount}.`,
    });
  }

  const destinationFields = usesPstnDestination(user.country)
    ? { destinationType: "pstn" as const }
    : {
        // No PSTN destination to collect at all — calls ring in the
        // 9tel app itself via the Voice SDK, so this is immediately
        // "configured" with nothing further needed from the person.
        // NOTE: clientIdentity is per-USER, not per-number — if a
        // Business account provisions multiple Client-mode numbers,
        // they'd all ring the same Voice SDK registration. Distinct
        // per-number ringing (e.g. showing which of 3 business lines was
        // dialed) isn't implemented; see the README.
        destinationType: "client" as const,
        clientIdentity: clientIdentityForUser(req.userId),
        destinationVerified: true,
      };

  if (user.subscriptionTier === "free") {
    const extension = await assignExtension();
    const created = await prisma.nineTelNumber.create({
      data: {
        userId: req.userId,
        e164: SHARED_TOLLFREE_NUMBER,
        extension,
        country: user.country,
        numberType: "toll_free",
        status: "active",
        ...destinationFields,
      },
    });
    return res.json(toApiShape(created));
  }

  try {
    const number = await telephony.provisionNumber(user.country);
    const created = await prisma.nineTelNumber.create({
      data: {
        userId: req.userId,
        e164: number.e164,
        extension: null,
        country: user.country,
        numberType: number.numberType === "toll-free" ? "toll_free" : number.numberType,
        providerSid: number.providerSid,
        status: "active",
        ...destinationFields,
      },
    });
    res.json(toApiShape(created));
  } catch (err) {
    res.status(501).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/numbers/upgrade-to-dedicated — moves the caller's PRIMARY
 * (first) shared-extension number off it and onto a real dedicated
 * number, once their tier has actually changed (i.e. after a successful
 * billing webhook) — checked server-side for the same reason as above.
 * Only ever touches one number, since this is specifically the
 * Free→paid upgrade path, not general multi-number management.
 */
router.post("/upgrade-to-dedicated", async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Unauthenticated" });
  if (user.subscriptionTier === "free") {
    return res.status(403).json({ error: "Upgrade to Premium/Business before requesting a dedicated number" });
  }
  if (!user.country) {
    return res.status(400).json({ error: "No country on file for this account" });
  }

  const primary = await prisma.nineTelNumber.findFirst({ where: { userId: req.userId }, orderBy: { createdAt: "asc" } });
  if (!primary) return res.status(404).json({ error: "No existing number to upgrade" });

  try {
    const number = await telephony.provisionNumber(user.country);
    const updated = await prisma.nineTelNumber.update({
      where: { id: primary.id },
      data: {
        e164: number.e164,
        extension: null,
        providerSid: number.providerSid,
        numberType: number.numberType === "toll-free" ? "toll_free" : number.numberType,
        status: "active",
      },
    });
    res.json(toApiShape(updated));
  } catch (err) {
    res.status(501).json({ error: (err as Error).message });
  }
});

/**
 * Shared logic for setting a destination phone number on a specific
 * NineTelNumber row — used by both the canonical /:numberId/destination
 * route and the back-compat /destination alias below, so there's one
 * real implementation rather than two routes drifting apart.
 */
async function setDestinationForNumber(userId: string, numberId: string, destinationE164: string, res: Response) {
  const number = await prisma.nineTelNumber.findFirst({ where: { id: numberId, userId } });
  if (!number) return res.status(404).json({ error: "Number not found" });
  if (number.destinationType === "client") {
    return res.status(400).json({
      error: "This number delivers calls via the 9tel app — there's no phone number to set.",
    });
  }

  const updated = await prisma.nineTelNumber.update({
    where: { id: number.id },
    data: { destinationE164, destinationVerified: false },
  });

  const code = Math.floor(Math.random() * 10 ** DESTINATION_OTP_LENGTH)
    .toString()
    .padStart(DESTINATION_OTP_LENGTH, "0");
  const codeHash = await bcrypt.hash(code, 10);
  await prisma.otpCode.create({
    data: {
      userId,
      phone: destinationE164,
      codeHash,
      expiresAt: new Date(Date.now() + DESTINATION_OTP_TTL_MINUTES * 60 * 1000),
    },
  });

  let codeSent = true;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[dev only] Destination verification code for ${destinationE164}: ${code}`);
  } else {
    try {
      await sendSms(
        destinationE164,
        `Your 9tel forwarding verification code is ${code}. It expires in ${DESTINATION_OTP_TTL_MINUTES} minutes.`
      );
    } catch (err) {
      console.error("Failed to send destination verification SMS:", (err as Error).message);
      codeSent = false;
    }
  }

  res.json({ ...toApiShape(updated), codeSent });
}

/** Shared logic for verifying a destination code on a specific number — see setDestinationForNumber above for why this is factored out. */
async function verifyDestinationForNumber(userId: string, numberId: string, code: string, res: Response) {
  const number = await prisma.nineTelNumber.findFirst({ where: { id: numberId, userId } });
  if (!number?.destinationE164) return res.status(400).json({ error: "No destination number on file" });

  const candidates = await prisma.otpCode.findMany({
    where: {
      userId,
      phone: number.destinationE164,
      consumedAt: null,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  let matched = null;
  for (const candidate of candidates) {
    if (await bcrypt.compare(code, candidate.codeHash)) {
      matched = candidate;
      break;
    }
  }

  if (!matched) return res.json({ verified: false });

  await prisma.otpCode.update({ where: { id: matched.id }, data: { consumedAt: new Date() } });
  await prisma.nineTelNumber.update({ where: { id: number.id }, data: { destinationVerified: true } });

  res.json({ verified: true });
}

/**
 * PATCH /api/numbers/:numberId/destination — set/update the forwarding
 * PHONE NUMBER for ONE SPECIFIC number, and send a verification code to
 * it. Only valid when that number's destinationType is "pstn" —
 * Client-delivery users have nothing to set here (their destination is
 * the 9tel app itself, auto-configured at provision time).
 *
 * Operating on a specific numberId (rather than always "the" number)
 * is what makes this correct for Business accounts with more than
 * one number — each can have its own destination.
 */
router.patch("/:numberId/destination", async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  const { destinationE164 } = req.body as { destinationE164: string };
  await setDestinationForNumber(req.userId, req.params.numberId, destinationE164, res);
});

/** POST /api/numbers/:numberId/destination/verify — confirm the verification code for one specific number. */
router.post("/:numberId/destination/verify", async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  const { code } = req.body as { code: string };
  await verifyDestinationForNumber(req.userId, req.params.numberId, code, res);
});

/**
 * Back-compat aliases: mobile's existing Home screen (Free/Premium,
 * always exactly one number) calls PATCH /destination and
 * POST /destination/verify with no numberId at all — these resolve to
 * the caller's PRIMARY (first) number and call the same shared logic
 * directly, so that code keeps working unchanged. New Business
 * multi-number UI should use the /:numberId/... routes above instead.
 */
router.patch("/destination", async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  const primary = await prisma.nineTelNumber.findFirst({ where: { userId: req.userId }, orderBy: { createdAt: "asc" } });
  if (!primary) return res.status(404).json({ error: "No number provisioned yet" });
  const { destinationE164 } = req.body as { destinationE164: string };
  await setDestinationForNumber(req.userId, primary.id, destinationE164, res);
});
router.post("/destination/verify", async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  const primary = await prisma.nineTelNumber.findFirst({ where: { userId: req.userId }, orderBy: { createdAt: "asc" } });
  if (!primary) return res.status(404).json({ error: "No number provisioned yet" });
  const { code } = req.body as { code: string };
  await verifyDestinationForNumber(req.userId, primary.id, code, res);
});

function toApiShape(number: {
  id: string;
  e164: string;
  extension: string | null;
  country: string;
  numberType: string;
  status: string;
  destinationType: string;
  destinationE164: string | null;
  destinationVerified: boolean;
  clientIdentity: string | null;
}) {
  return {
    id: number.id,
    e164: number.e164,
    extension: number.extension,
    country: number.country,
    numberType: number.numberType === "toll_free" ? "toll-free" : number.numberType,
    status: number.status,
    destinationType: number.destinationType,
    destinationE164: number.destinationE164,
    destinationVerified: number.destinationVerified,
    clientIdentity: number.clientIdentity,
  };
}

export default router;
