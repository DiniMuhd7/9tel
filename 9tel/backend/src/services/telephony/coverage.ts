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
