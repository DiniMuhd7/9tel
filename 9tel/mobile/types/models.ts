export type SubscriptionTier = "free" | "premium" | "business";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  subscriptionTier: SubscriptionTier;
}

export interface NineTelNumber {
  id: string;
  e164: string; // the 9tel number itself
  country: string;
  numberType: "local" | "toll-free" | "mobile"; // toll-free by default in US/CA/GB, local elsewhere
  status: "active" | "inactive" | "pending";
  destinationE164: string | null;
  destinationVerified: boolean;
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
