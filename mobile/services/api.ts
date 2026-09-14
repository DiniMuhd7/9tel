import { CallRecord, NineTelNumber, User } from "../types/models";

// TODO: move to env config (expo-constants) per environment.
const API_BASE_URL = "https://api.9tel.example.com";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export const api = {
  auth: {
    /** Silent guest-session bootstrap — no phone/email/name required. */
    device: (deviceId: string) =>
      request<{ token: string; user: User }>("/api/auth/device", {
        method: "POST",
        body: JSON.stringify({ deviceId }),
      }),
    /**
     * Sets ONLY country — deliberately separate from updateProfile,
     * since even a guest needs a country on file before a number can be
     * provisioned (it decides toll-free vs local, and PSTN vs in-app
     * Voice SDK delivery — see numbers.provision below).
     */
    setCountry: (token: string, country: string) =>
      request<{ user: User }>("/api/auth/country", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ country }),
      }),
    requestOtp: (phone: string) =>
      request<{ sent: boolean }>("/api/auth/otp", { method: "POST", body: JSON.stringify({ phone }) }),
    /**
     * `linkToken`, when passed, is the caller's existing guest session
     * token — the backend uses it to LINK the phone to that same account
     * (at Premium upgrade) instead of creating a separate one. Omit it
     * for a plain login / restoring an existing account on a new device.
     */
    verifyOtp: (phone: string, code: string, linkToken?: string) =>
      request<{ token: string; user: User }>("/api/auth/verify", {
        method: "POST",
        headers: linkToken ? { Authorization: `Bearer ${linkToken}` } : undefined,
        body: JSON.stringify({ phone, code }),
      }),
    updateProfile: (token: string, profile: { name: string; email: string; country: string }) =>
      request<{ user: User }>("/api/auth/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(profile),
      }),
    /** Refetches the current user — used to poll for a tier change after checkout. */
    getMe: (token: string) =>
      request<{ user: User }>("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } }),
  },
  numbers: {
    getMine: (token: string) =>
      request<NineTelNumber>("/api/numbers/me", { headers: { Authorization: `Bearer ${token}` } }),
    /** All of the caller's numbers — only meaningfully more than one for Business accounts. */
    list: (token: string) =>
      request<NineTelNumber[]>("/api/numbers", { headers: { Authorization: `Bearer ${token}` } }),
    // No params — the backend derives inbound number type AND
    // PSTN-vs-Voice-SDK delivery entirely from the caller's own tier and
    // country on file (see auth.setCountry above), never from
    // client-supplied values.
    provision: (token: string) =>
      request<NineTelNumber>("/api/numbers/provision", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
    // codeSent: false means the number/OTP record was saved, but the SMS
    // itself failed to send (see routes/numbers.ts) — the destination
    // isn't lost, but the person needs to know a code isn't actually on
    // its way yet.
    // codeSent: false means the number/OTP record was saved, but the SMS
    // itself failed to send (see routes/numbers.ts) — the destination
    // isn't lost, but the person needs to know a code isn't actually on
    // its way yet. `numberId`, when passed, targets one specific number
    // (a Business account's non-primary number) — omit it for the
    // Free/Premium single-number case, which hits the back-compat alias
    // that resolves to the primary number automatically.
    setDestination: (token: string, destinationE164: string, numberId?: string) =>
      request<NineTelNumber & { codeSent: boolean }>(
        numberId ? `/api/numbers/${numberId}/destination` : "/api/numbers/destination",
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ destinationE164 }),
        }
      ),
    /**
     * Called once checkout-callback confirms a successful Premium/Business
     * purchase — moves the user off the shared toll-free number/extension
     * and onto a real dedicated number. No params needed; the backend
     * derives numberType/country from the caller's own account.
     */
    upgradeToDedicated: (token: string) =>
      request<NineTelNumber>("/api/numbers/upgrade-to-dedicated", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
    verifyDestination: (token: string, code: string, numberId?: string) =>
      request<{ verified: boolean }>(
        numberId ? `/api/numbers/${numberId}/destination/verify` : "/api/numbers/destination/verify",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code }),
        }
      ),
  },
  calls: {
    list: (token: string) =>
      request<CallRecord[]>("/api/calls", { headers: { Authorization: `Bearer ${token}` } }),
  },
  billing: {
    getPlans: () =>
      request<{ id: string; name: string; priceLabel: string; monthlyMinutes: number; maxNumbers: number; features: string[] }[]>(
        "/api/billing/plans"
      ),
    startCheckout: (token: string, planId: string) =>
      request<{ checkoutUrl: string }>("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId }),
      }),
  },
  voice: {
    /** Access Token for registering the Voice SDK client — see services/voiceClient.ts. */
    getToken: (token: string) =>
      request<{ token: string; identity: string }>("/api/voice/token", {
        headers: { Authorization: `Bearer ${token}` },
      }),
  },
};
