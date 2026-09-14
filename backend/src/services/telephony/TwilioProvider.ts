import { TelephonyProvider, CallDestination } from "./TelephonyProvider";
import { isTollFreeSupported, REFERENCE_PRICING_USD } from "./coverage";
import { getTwilioClient } from "./client";

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
 */

function voiceWebhookUrl(): string {
  const base = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (!base) throw new Error("TWILIO_WEBHOOK_BASE_URL isn't set — needed to configure a purchased number's voice URL.");
  return `${base}/api/voice/incoming`;
}

export class TwilioProvider implements TelephonyProvider {
  buildIncomingCallResponse(params: {
    destination: CallDestination;
    playAd: boolean;
    adAudioUrl?: string;
    statusCallbackUrl?: string;
    /** Original PSTN caller's number, shown in the Voice SDK client's incoming-call UI via a <Parameter>. */
    callerNumber?: string;
  }): string {
    const { destination, playAd, adAudioUrl, statusCallbackUrl, callerNumber } = params;

    const adBlock = playAd
      ? adAudioUrl
        ? `<Play>${adAudioUrl}</Play>`
        : `<Say>This call is being connected by 9tel.</Say>`
      : "";

    const dialAttrs = statusCallbackUrl
      ? ` action="${statusCallbackUrl}" method="POST"`
      : "";

    // <Client> delivers the call over WebRTC to the Voice SDK-registered
    // app instead of dialing a real phone number — no PSTN termination
    // leg at all for this half of the call. The <Parameter> surfaces the
    // original caller's number in the app's incoming-call UI (see
    // mobile's IncomingCallOverlay), since the Client identity itself
    // carries no caller info on its own.
    const dialTarget =
      destination.type === "pstn"
        ? destination.e164
        : `<Client>${destination.identity}${
            callerNumber ? `<Parameter name="from" value="${callerNumber}"/>` : ""
          }</Client>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${adBlock}
  <Say>Connecting your call.</Say>
  <Dial${dialAttrs}>${dialTarget}</Dial>
</Response>`;
  }

  /**
   * Picks toll-free for US/CA/GB (where Twilio actually sells it),
   * local otherwise. Always confirms availability first — even within
   * supported countries, toll-free inventory can be temporarily
   * exhausted for a given area/prefix or number type.
   */
  async provisionNumber(
    countryCode: string
  ): Promise<{ e164: string; providerSid: string; numberType: "local" | "toll-free" | "mobile" }> {
    const country = countryCode.toUpperCase();
    const preferTollFree = isTollFreeSupported(country);

    if (preferTollFree) {
      const found = await this.findAvailableNumber(country, "toll-free");
      if (found) return this.purchase(found, "toll-free");
      // Toll-free preferred but temporarily unavailable — fall through to local.
    }

    const found = await this.findAvailableNumber(country, "local");
    if (!found) {
      throw new Error(
        `No local or toll-free numbers currently available for ${country}. Consider a non-Twilio local partner for this country.`
      );
    }
    return this.purchase(found, "local");
  }

  async checkNumberAvailability(
    countryCode: string,
    numberType: "local" | "toll-free" | "mobile"
  ): Promise<boolean> {
    if (numberType === "toll-free" && !isTollFreeSupported(countryCode)) {
      // Don't even hit the API — Twilio doesn't sell toll-free here.
      return false;
    }
    const found = await this.findAvailableNumber(countryCode, numberType);
    return found !== null;
  }

  /**
   * Searches Twilio's AvailablePhoneNumbers resource for a single
   * voice-capable candidate, without buying it. Returns null (not a
   * throw) when nothing's available — that's a normal, expected outcome
   * callers branch on, not an error condition.
   */
  private async findAvailableNumber(
    countryCode: string,
    numberType: "local" | "toll-free" | "mobile"
  ): Promise<string | null> {
    const client = getTwilioClient();
    const country = countryCode.toUpperCase();
    const searchParams = { voiceEnabled: true, limit: 1 };

    try {
      const results =
        numberType === "toll-free"
          ? await client.availablePhoneNumbers(country).tollFree.list(searchParams)
          : numberType === "mobile"
            ? await client.availablePhoneNumbers(country).mobile.list(searchParams)
            : await client.availablePhoneNumbers(country).local.list(searchParams);

      return results[0]?.phoneNumber ?? null;
    } catch (err) {
      // Twilio 404s the AvailablePhoneNumbers endpoint itself for some
      // countries/number-type combos it doesn't offer at all (distinct
      // from "offers it but none in stock right now") — treat both as
      // "not available" rather than surfacing a raw API error here.
      return null;
    }
  }

  /** Actually purchases a found number and points its voice URL at this backend. */
  private async purchase(
    e164: string,
    numberType: "local" | "toll-free"
  ): Promise<{ e164: string; providerSid: string; numberType: "local" | "toll-free" | "mobile" }> {
    const client = getTwilioClient();
    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: e164,
      voiceUrl: voiceWebhookUrl(),
      voiceMethod: "POST",
    });
    return { e164: purchased.phoneNumber, providerSid: purchased.sid, numberType };
  }

  /**
   * Used for Free-tier users sharing one toll-free number instead of each
   * having their own — see numbers/sharedExtension.ts for how extensions
   * are assigned. `<Gather>` collects DTMF digits and posts them to
   * gatherActionUrl (the /api/voice/extension route).
   */
  buildExtensionPromptResponse(params: { gatherActionUrl: string; extensionDigits: number }): string {
    const { gatherActionUrl, extensionDigits } = params;
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="${extensionDigits}" finishOnKey="#" action="${gatherActionUrl}" method="POST" timeout="8">
    <Say>Welcome to 9 tel. Please enter the extension of the person you are trying to reach, followed by the pound sign.</Say>
  </Gather>
  <Say>We didn't receive an extension. Goodbye.</Say>
</Response>`;
  }

  buildExtensionNotFoundResponse(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>That extension wasn't recognized. Please check it and try again.</Say>
</Response>`;
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
