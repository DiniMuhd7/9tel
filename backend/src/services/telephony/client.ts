import twilio from "twilio";

let cachedClient: ReturnType<typeof twilio> | null = null;

/** Lazily constructs the Twilio REST client, failing loudly (not silently) if env is missing. */
export function getTwilioClient() {
  if (cachedClient) return cachedClient;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error("Twilio isn't configured — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }
  cachedClient = twilio(accountSid, authToken);
  return cachedClient;
}
