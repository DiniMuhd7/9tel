import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../db/client";
import { issueAuthToken, requireAuth, AuthedRequest } from "../middleware/auth";
import { sendSms } from "../services/sms";

const router = Router();

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;

function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return Math.floor(Math.random() * max).toString().padStart(OTP_LENGTH, "0");
}

function toPublicUser(user: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string;
  subscriptionTier: string;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    country: user.country,
    subscriptionTier: user.subscriptionTier,
    // Free-tier calling works with no identity at all — this is only
    // meaningful once a phone has been linked (at upgrade time), so the
    // client uses it to decide whether the complete-profile screen is
    // needed, never to gate ordinary app usage.
    profileComplete: user.name.trim().length > 0,
  };
}

/** Reads a Bearer JWT if present, without requiring one (unlike requireAuth). */
function optionalUserId(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const payload = jwt.verify(header.slice("Bearer ".length), secret) as { sub: string };
    return payload.sub;
  } catch {
    return null;
  }
}

/**
 * POST /api/auth/device — creates or resumes a GUEST session for a
 * device, with no phone/email/name required. This is what the app calls
 * silently on first launch so Free-tier calling works immediately, with
 * no registration or login screen in the way. Registration only enters
 * the picture later, at Premium upgrade (see /verify below).
 */
router.post("/device", async (req: Request, res: Response) => {
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId) return res.status(400).json({ error: "deviceId is required" });

  let user = await prisma.user.findUnique({ where: { deviceId } });
  if (!user) {
    user = await prisma.user.create({ data: { deviceId } });
  }

  const token = issueAuthToken(user.id);
  res.json({ token, user: toPublicUser(user) });
});

/** POST /api/auth/otp — send an OTP code to a phone number (not tied to any user yet). */
router.post("/otp", async (req: Request, res: Response) => {
  const { phone } = req.body as { phone?: string };
  if (!phone) return res.status(400).json({ error: "phone is required" });

  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await prisma.otpCode.create({ data: { phone, codeHash, expiresAt } });

  if (process.env.NODE_ENV !== "production") {
    // Skip the real SMS send in dev — log the code instead so local
    // testing doesn't burn real Twilio SMS sends or need a configured
    // TWILIO_SMS_FROM_NUMBER.
    console.log(`[dev only] OTP for ${phone}: ${code}`);
    return res.json({ sent: true });
  }

  try {
    await sendSms(phone, `Your 9tel verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);
    res.json({ sent: true });
  } catch (err) {
    console.error("Failed to send OTP SMS:", (err as Error).message);
    // Don't claim success when delivery actually failed — the person
    // would otherwise wait for a code that's never arriving.
    res.status(502).json({ error: "Couldn't send verification code. Please try again." });
  }
});

/**
 * POST /api/auth/verify — verifies an OTP code, then either:
 *
 *  - LINKS the phone to the caller's existing guest session, if an
 *    Authorization header for a phone-less guest user is present (the
 *    upgrade-to-Premium path — see mobile's Premium/login flow). No new
 *    user is created; the guest's existing number/extension/call history
 *    carries over untouched.
 *  - Otherwise, finds-or-creates a user by phone directly (a returning
 *    Premium user logging in on a new device with no guest session yet).
 *
 * If the phone in question already belongs to a DIFFERENT user than the
 * currently-authenticated guest, this refuses rather than silently
 * merging accounts — the client should tell the person to continue on
 * their original device, or handle the merge as a deliberate support
 * flow. That merge isn't implemented here.
 */
router.post("/verify", async (req: Request, res: Response) => {
  const { phone, code } = req.body as { phone?: string; code?: string };
  if (!phone || !code) return res.status(400).json({ error: "phone and code are required" });

  const candidates = await prisma.otpCode.findMany({
    where: { phone, consumedAt: null, expiresAt: { gte: new Date() } },
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
  if (!matched) return res.status(401).json({ error: "Invalid or expired code" });

  const existingByPhone = await prisma.user.findUnique({ where: { phone } });
  const callerId = optionalUserId(req);

  let user;
  if (callerId) {
    const caller = await prisma.user.findUnique({ where: { id: callerId } });
    if (caller && !caller.phone) {
      // Guest session linking a phone for the first time.
      if (existingByPhone && existingByPhone.id !== caller.id) {
        return res.status(409).json({
          error: "This phone number is already registered to another account. Log in with it on that account instead.",
        });
      }
      user = await prisma.user.update({ where: { id: caller.id }, data: { phone } });
    } else if (caller && caller.phone === phone) {
      // Re-verifying the same already-linked phone — no-op, just proceed.
      user = caller;
    } else {
      // Caller is authenticated but as a DIFFERENT phone, or the token
      // was otherwise unusable for linking — fall through to normal
      // find-or-create so this doesn't silently fail.
      user = existingByPhone ?? (await prisma.user.create({ data: { phone } }));
    }
  } else {
    // No guest session at all (e.g. fresh install, restoring an existing
    // Premium account) — plain phone-based find-or-create.
    user = existingByPhone ?? (await prisma.user.create({ data: { phone } }));
  }

  await prisma.otpCode.update({ where: { id: matched.id }, data: { consumedAt: new Date() } });

  const token = issueAuthToken(user.id);
  res.json({ token, user: toPublicUser(user) });
});

/**
 * PATCH /api/auth/profile — completes registration once a phone is
 * linked (at Premium upgrade time): sets name/email/country on the
 * now-identified user.
 */
router.patch("/profile", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { name, email, country } = req.body as { name?: string; email?: string; country?: string };
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  if (!name?.trim() || !email?.trim() || !country?.trim()) {
    return res.status(400).json({ error: "name, email, and country are required" });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name: name.trim(), email: email.trim(), country: country.trim() },
    });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    res.status(409).json({ error: "That email is already in use" });
  }
});

/**
 * PATCH /api/auth/country — sets ONLY country, for guests included. This
 * is deliberately separate from PATCH /profile (which needs name/email
 * and is deferred to Premium upgrade): a guest's country still needs to
 * be known early, to decide how their inbound number is provisioned
 * (toll-free vs local) and — more importantly — whether their forwarded
 * calls get delivered over PSTN or via the in-app Voice SDK client (see
 * services/telephony/coverage.ts's usesPstnDestination and
 * routes/numbers.ts). Asking for a country alone isn't the kind of
 * identity-revealing registration step Free tier is meant to avoid.
 */
router.patch("/country", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { country } = req.body as { country?: string };
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  if (!country?.trim()) return res.status(400).json({ error: "country is required" });

  const user = await prisma.user.update({ where: { id: req.userId }, data: { country: country.trim() } });
  res.json({ user: toPublicUser(user) });
});

/**
 * GET /api/auth/me — refetches the current user. Exists mainly for
 * mobile's checkout-callback screen: Stripe redirects back to the app as
 * soon as payment completes, but the webhook that actually updates
 * subscriptionTier can land a moment later — there's a real race there,
 * not just a theoretical one. checkout-callback polls this a few times
 * rather than assuming the tier is updated the instant it returns.
 */
router.get("/me", requireAuth, async (req: AuthedRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ error: "Unauthenticated" });
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(401).json({ error: "Unauthenticated" });
  res.json({ user: toPublicUser(user) });
});

export default router;
