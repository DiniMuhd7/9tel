import { prisma } from "../db/client";
import { SubscriptionTier } from "@prisma/client";

const TIER_MONTHLY_MINUTES: Record<SubscriptionTier, number> = {
  free: Number(process.env.FREE_TIER_MONTHLY_MINUTES ?? 15),
  premium: Number(process.env.PREMIUM_TIER_MONTHLY_MINUTES ?? 500),
  // Business isn't in .env.example yet — default generously until real
  // per-plan limits are defined (see PLANS in services/payments).
  business: Number(process.env.BUSINESS_TIER_MONTHLY_MINUTES ?? 2000),
};

function currentBillingMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Minutes already used this calendar month, from recorded call durations. */
export async function minutesUsedThisMonth(userId: string): Promise<number> {
  const result = await prisma.callRecord.aggregate({
    where: { userId, startedAt: { gte: currentBillingMonthStart() } },
    _sum: { durationSeconds: true },
  });
  return (result._sum.durationSeconds ?? 0) / 60;
}

export function monthlyMinuteCap(tier: SubscriptionTier): number {
  return TIER_MONTHLY_MINUTES[tier];
}

/**
 * Checked before connecting a call (see routes/voice.ts). Returns whether
 * the user has minutes remaining this month, plus how many, so the
 * pre-dial TwiML can (eventually) announce it if desired.
 */
export async function hasMinutesRemaining(
  userId: string,
  tier: SubscriptionTier
): Promise<{ allowed: boolean; usedMinutes: number; capMinutes: number }> {
  const usedMinutes = await minutesUsedThisMonth(userId);
  const capMinutes = monthlyMinuteCap(tier);
  return { allowed: usedMinutes < capMinutes, usedMinutes, capMinutes };
}
