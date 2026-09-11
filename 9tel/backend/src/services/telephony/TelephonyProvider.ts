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

export interface TelephonyProvider {
  /**
   * Returns provider-specific call-control markup/instructions (e.g. TwiML
   * for Twilio) for an incoming call, given the resolved destination and
   * whether an ad should play first.
   */
  buildIncomingCallResponse(params: {
    destinationE164: string;
    playAd: boolean;
    adAudioUrl?: string;
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
}
