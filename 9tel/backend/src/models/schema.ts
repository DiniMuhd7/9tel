/**
 * These interfaces mirror the intended Postgres schema. Not an ORM —
 * plug in Prisma/Drizzle/knex per your preference and generate migrations
 * from these shapes.
 */

export interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  subscription_tier: "free" | "premium" | "business";
  created_at: Date;
}

export interface NineTelNumberRow {
  id: string;
  user_id: string;
  e164: string;
  country: string;
  number_type: "local" | "toll-free" | "mobile"; // toll-free by default in US/CA/GB, local elsewhere
  provider_sid: string; // e.g. Twilio IncomingPhoneNumber SID
  status: "active" | "inactive" | "pending";
  destination_e164: string | null;
  destination_verified: boolean;
  created_at: Date;
}

export interface CallRecordRow {
  id: string;
  user_id: string;
  ninetel_number_id: string;
  provider_call_sid: string;
  caller_number: string;
  destination_number: string;
  started_at: Date;
  duration_seconds: number;
  status: "answered" | "missed" | "failed";
  ad_played: boolean;
}

export interface AdvertisementRow {
  id: string;
  title: string;
  audio_url: string;
  duration_seconds: number;
  target_country: string | null;
  start_date: Date;
  end_date: Date;
  active: boolean;
}
