import { getTwilioClient } from "./telephony/client";

/**
 * Sends a plain SMS via Twilio's Messaging API. Used for OTP login codes
 * (routes/auth.ts) and destination-verification codes
 * (routes/numbers.ts) — both previously just console.logged the code in
 * non-production and did nothing at all otherwise.
 *
 * Deliberately throws on failure rather than swallowing it — callers
 * should surface a real error to the client instead of claiming a code
 * was sent when it wasn't; see how routes/auth.ts and routes/numbers.ts
 * handle this.
 *
 * Requires a Twilio number capable of sending SMS in `to`'s country
 * (TWILIO_SMS_FROM_NUMBER) — this does NOT have to be the same number(s)
 * 9tel provisions for call forwarding, and in most cases shouldn't be: a
 * shared toll-free number used for inbound calls may not be SMS-capable
 * or verified for A2P messaging in every destination country.
 *
 * TODO: for OTP specifically, Twilio Verify is worth considering instead
 * of hand-rolled SMS — it handles delivery retries, fraud/rate-limit
 * protection, and doesn't require managing your own from-number
 * inventory per country. This plain-SMS approach was kept here since the
 * app already generates/hashes/verifies its own OTP codes rather than
 * delegating that to Verify — swapping later means changing this
 * function's implementation, not its callers.
 */
export async function sendSms(to: string, body: string): Promise<void> {
  const from = process.env.TWILIO_SMS_FROM_NUMBER;
  if (!from) {
    throw new Error("TWILIO_SMS_FROM_NUMBER isn't set — needed to send SMS via Twilio.");
  }

  const client = getTwilioClient();
  await client.messages.create({ to, from, body });
}
