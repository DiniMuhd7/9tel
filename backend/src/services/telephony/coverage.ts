/**
 * Which countries Twilio actually sells toll-free voice numbers in.
 * Confirmed from Twilio's coverage page: toll-free purchase is limited to
 * these three — everywhere else needs a local number (or a non-Twilio
 * local/toll-free partner, as with the Nigeria case).
 */
export const TWILIO_TOLL_FREE_COUNTRIES = new Set(["US", "CA", "GB"]);

/**
 * Rough published per-minute + rental costs, used only for cost estimates
 * shown to the user/admin before provisioning — NOT for billing. Always
 * re-check live rates via the Twilio Pricing API
 * (client.pricing.v1.voice.countries(countryCode).fetch()) before
 * committing to a plan, since these change periodically.
 */
export const REFERENCE_PRICING_USD = {
  US: {
    tollFree: { rentalPerMonth: 2.15, inboundPerMin: 0.022, outboundPerMin: 0.014 },
    local: { rentalPerMonth: 1.15, inboundPerMin: 0.0085, outboundPerMin: 0.013 },
  },
  CA: {
    tollFree: { rentalPerMonth: 2.15, inboundPerMin: 0.022, outboundPerMin: 0.014 },
    local: { rentalPerMonth: 1.15, inboundPerMin: 0.0085, outboundPerMin: 0.013 },
  },
  GB: {
    tollFree: { rentalPerMonth: 2.15, inboundPerMin: 0.022, outboundPerMin: 0.02 },
    local: { rentalPerMonth: 1.15, inboundPerMin: 0.0085, outboundPerMin: 0.02 },
  },
} as const;

export function isTollFreeSupported(countryCode: string): boolean {
  return TWILIO_TOLL_FREE_COUNTRIES.has(countryCode.toUpperCase());
}

/**
 * Which countries get PSTN forwarding (a real dial-out to the user's own
 * phone) vs. in-app delivery via the Twilio Voice SDK. Deliberately the
 * SAME set as toll-free support: these are the countries where Twilio's
 * outbound termination is cheap (~$0.013-0.014/min, per the
 * revenue-feasibility breakdown) — everywhere else, PSTN termination
 * varies wildly and is often the dominant per-minute cost (Nigeria
 * mobile alone was ~$0.235/min), so calls are delivered to the 9tel app
 * itself over WebRTC instead of dialed out to a real number. See
 * routes/voice.ts and services/telephony/voiceToken.ts.
 */
export function usesPstnDestination(countryCode: string): boolean {
  return TWILIO_TOLL_FREE_COUNTRIES.has(countryCode.toUpperCase());
}
