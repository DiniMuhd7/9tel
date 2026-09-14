import twilio from "twilio";

const AccessToken = twilio.jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

const TOKEN_TTL_SECONDS = 3600; // Voice SDK clients should refresh well before this expires

/**
 * A stable, non-guessable Client identity for a user's Voice SDK
 * registration. Deliberately not the raw user id (which could be enough
 * to guess/target another user's identity if it were ever exposed
 * client-side) — prefixed and namespaced instead.
 */
export function clientIdentityForUser(userId: string): string {
  return `9tel_user_${userId}`;
}

/**
 * Issues a short-lived Access Token the mobile app uses to register with
 * Twilio's Voice SDK (twilio-voice-react-native) and receive calls
 * delivered via <Dial><Client>...</Client></Dial> — see routes/voice.ts.
 *
 * Requires a Twilio API Key/Secret (NOT the account auth token — Voice
 * SDK access tokens are signed with an API Key) and a TwiML Application
 * SID configured with this backend's voice URL, all from env.
 */
export function generateVoiceAccessToken(identity: string): string {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    throw new Error(
      "Voice SDK isn't configured — set TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID."
    );
  }

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true, // lets this identity receive inbound <Client> calls
  });

  const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, {
    identity,
    ttl: TOKEN_TTL_SECONDS,
  });
  token.addGrant(voiceGrant);

  return token.toJwt();
}
