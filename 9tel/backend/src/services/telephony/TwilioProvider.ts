import { TelephonyProvider } from "./TelephonyProvider";
import { isTollFreeSupported, REFERENCE_PRICING_USD } from "./coverage";

/**
 * Twilio-backed implementation.
 *
 * Number-type strategy: Twilio only sells toll-free voice numbers in the
 * US, Canada, and UK (confirmed via Twilio's coverage page — everywhere
 * else needs a local number, or a non-Twilio local/toll-free partner, as
 * with Nigeria). provisionNumber() below picks toll-free automatically for
 * those three countries and falls back to local for everyone else, so
 * callers of this class don't have to special-case country logic
 * themselves.
 *
 * TODO: wire up the real `twilio` SDK client using
 * TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN from env, and replace the TwiML
 * string-building below with the `twilio.twiml.VoiceResponse` builder.
 */
export class TwilioProvider implements TelephonyProvider {
  buildIncomingCallResponse(params: {
    destinationE164: string;
    playAd: boolean;
    adAudioUrl?: string;
  }): string {
    const { destinationE164, playAd, adAudioUrl } = params;

    const adBlock = playAd
      ? adAudioUrl
        ? `<Play>${adAudioUrl}</Play>`
        : `<Say>This call is being connected by 9tel.</Say>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${adBlock}
  <Say>Connecting your call.</Say>
  <Dial>${destinationE164}</Dial>
</Response>`;
  }

  /**
   * Picks toll-free for US/CA/GB (where Twilio actually sells it),
   * local otherwise. Always confirms availability first — even within
   * supported countries, toll-free inventory can be temporarily
   * exhausted for a given area/prefix.
   */
  async provisionNumber(
    countryCode: string
  ): Promise<{ e164: string; providerSid: string; numberType: "local" | "toll-free" | "mobile" }> {
    const country = countryCode.toUpperCase();
    const preferTollFree = isTollFreeSupported(country);

    if (preferTollFree) {
      const tollFreeAvailable = await this.checkNumberAvailability(country, "toll-free");
      if (tollFreeAvailable) {
        // TODO: call Twilio's AvailablePhoneNumbers TollFree subresource
        // to find a number, then POST to IncomingPhoneNumbers to buy it.
        // return { e164: "+1800...", providerSid: "PN...", numberType: "toll-free" };
        throw new Error("Not implemented — wire up Twilio toll-free provisioning.");
      }
      // Toll-free preferred but temporarily unavailable — fall through to local.
    }

    const localAvailable = await this.checkNumberAvailability(country, "local");
    if (!localAvailable) {
      throw new Error(
        `No local or toll-free numbers currently available for ${country}. Consider a non-Twilio local partner for this country.`
      );
    }
    // TODO: call Twilio's AvailablePhoneNumbers Local subresource, then
    // POST to IncomingPhoneNumbers to buy it.
    throw new Error("Not implemented — wire up Twilio local number provisioning.");
  }

  async checkNumberAvailability(
    countryCode: string,
    numberType: "local" | "toll-free" | "mobile"
  ): Promise<boolean> {
    if (numberType === "toll-free" && !isTollFreeSupported(countryCode)) {
      // Don't even hit the API — Twilio doesn't sell toll-free here.
      return false;
    }
    // TODO: query Twilio's AvailablePhoneNumbers resource for the country
    // and number type before attempting provisionNumber().
    throw new Error("Not implemented — wire up Twilio availability check.");
  }

  /**
   * Rough monthly cost estimate for a given country/number-type/usage
   * combo, for display to the user/admin before provisioning. Not used
   * for actual billing — re-check live Twilio Pricing API rates for that.
   */
  estimateMonthlyCostUsd(params: {
    countryCode: string;
    numberType: "local" | "toll-free";
    inboundMinutes: number;
    outboundMinutes: number;
  }): number | null {
    const country = params.countryCode.toUpperCase() as keyof typeof REFERENCE_PRICING_USD;
    const rates = REFERENCE_PRICING_USD[country]?.[params.numberType === "toll-free" ? "tollFree" : "local"];
    if (!rates) return null; // no reference pricing on file for this country
    return (
      rates.rentalPerMonth +
      params.inboundMinutes * rates.inboundPerMin +
      params.outboundMinutes * rates.outboundPerMin
    );
  }
}
