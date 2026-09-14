export type SubscriptionTier = "free" | "premium" | "business";

export interface User {
  id: string;
  name: string;
  // Null until a phone is linked — Free-tier guest sessions have neither.
  email: string | null;
  phone: string | null;
  country: string;
  subscriptionTier: SubscriptionTier;
  // False for a guest with no phone linked yet, or a linked-but-incomplete
  // profile. The client only routes on this at Premium upgrade time — it
  // never gates ordinary Free-tier app usage.
  profileComplete: boolean;
}

export interface NineTelNumber {
  id: string;
  e164: string; // the 9tel number itself (shared toll-free number for Free tier)
  extension: string | null; // set for Free-tier users sharing SHARED_TOLLFREE_NUMBER; null for dedicated numbers
  country: string;
  numberType: "local" | "toll-free" | "mobile"; // toll-free by default in US/CA/GB, local elsewhere
  status: "active" | "inactive" | "pending";
  // "pstn": destinationE164 is a real phone number (US/CA/GB).
  // "client": calls ring in the 9tel app itself via the Voice SDK —
  // clientIdentity is set, destinationE164 stays null. See
  // services/voiceClient.ts.
  destinationType: "pstn" | "client";
  destinationE164: string | null;
  destinationVerified: boolean;
  clientIdentity: string | null;
}

export interface CallRecord {
  id: string;
  callerLabel: string; // name if known, else masked/partial number
  callerNumber: string;
  destinationNumber: string;
  startedAt: string; // ISO timestamp
  durationSeconds: number;
  status: "answered" | "missed" | "failed";
}

export interface PremiumPlan {
  id: string;
  name: string;
  priceLabel: string; // e.g. "₦2,500 / month"
  features: string[];
}
