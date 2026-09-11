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
    requestOtp: (phone: string) =>
      request<{ sent: boolean }>("/api/auth/otp", { method: "POST", body: JSON.stringify({ phone }) }),
    verifyOtp: (phone: string, code: string) =>
      request<{ token: string; user: User }>("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      }),
  },
  numbers: {
    getMine: (token: string) =>
      request<NineTelNumber>("/api/numbers/me", { headers: { Authorization: `Bearer ${token}` } }),
    setDestination: (token: string, destinationE164: string) =>
      request<NineTelNumber>("/api/numbers/destination", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ destinationE164 }),
      }),
    verifyDestination: (token: string, code: string) =>
      request<{ verified: boolean }>("/api/numbers/destination/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      }),
  },
  calls: {
    list: (token: string) =>
      request<CallRecord[]>("/api/calls", { headers: { Authorization: `Bearer ${token}` } }),
  },
  billing: {
    getPlans: () => request<{ id: string; name: string; priceLabel: string; features: string[] }[]>("/api/billing/plans"),
    startCheckout: (token: string, planId: string) =>
      request<{ checkoutUrl: string }>("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId }),
      }),
  },
};
