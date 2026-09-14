/**
 * Abstraction over the underlying voice/CPaaS provider, per the doc's
 * recommendation: don't hard-code Twilio deeply into the application.
 * Swap in a different provider later by implementing this interface.
 */
export interface IncomingCallContext {
  callSid: string;
  fromNumber: string;
  toNumber: string; // the 9tel number that was dialed
}

/**
 * Where a resolved call gets sent for the forwarding/delivery leg:
 *  - pstn: a real phone number (US/CA/GB users — cheap termination).
 *  - client: an in-app Voice SDK Client identity, delivered over WebRTC
 *    with no PSTN dial-out at all (everyone else — see coverage.ts's
 *    usesPstnDestination).
 */
export type CallDestination = { type: "pstn"; e164: string } | { type: "client"; identity: string };

export interface TelephonyProvider {
  /**
   * Returns provider-specific call-control markup/instructions (e.g. TwiML
   * for Twilio) for an incoming call, given the resolved destination and
   * whether an ad should play first.
   */
  buildIncomingCallResponse(params: {
    destination: CallDestination;
    playAd: boolean;
    adAudioUrl?: string;
    /**
     * Set as the <Dial> verb's `action` URL, called once the dial leg
     * completes (with DialCallStatus/DialCallDuration params) — used
     * instead of a raw statusCallback so /api/voice/status can attribute
     * the call unambiguously via a query param (numberId), which matters
     * for the shared toll-free number where the dialed-to number alone
     * can't identify which user's call this was.
     */
    statusCallbackUrl?: string;
    /** Original PSTN caller's number — surfaced in the Voice SDK client's incoming-call UI when destination.type is "client". */
    callerNumber?: string;
  }): string;

  /**
   * Provision a new virtual number for a user in the given country.
   * Implementations should pick the best available number type for that
   * country themselves (e.g. toll-free where supported, local elsewhere)
   * rather than assuming toll-free everywhere — see TwilioProvider for the
   * US/CA/GB toll-free-first logic.
   */
  provisionNumber(countryCode: string): Promise<{
    e164: string;
    providerSid: string;
    numberType: "local" | "toll-free" | "mobile";
  }>;

  /** Check whether a number type (local/toll-free/mobile) is available for a country before provisioning. */
  checkNumberAvailability(countryCode: string, numberType: "local" | "toll-free" | "mobile"): Promise<boolean>;

  /**
   * TwiML/markup for the first leg of a call to a SHARED number: prompts
   * the caller to key in the extension of the person they're trying to
   * reach. Used for Free-tier users who don't have a dedicated number —
   * see coverage.ts / the numbers routes for how extensions are assigned.
   */
  buildExtensionPromptResponse(params: { gatherActionUrl: string; extensionDigits: number }): string;

  /** TwiML/markup returned when an entered extension doesn't match any user. */
  buildExtensionNotFoundResponse(): string;
}
