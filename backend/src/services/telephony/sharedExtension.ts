/**
 * Free-tier users share ONE toll-free number instead of each getting a
 * dedicated one, to avoid paying per-number rental for every free
 * signup. Each free user instead gets a short numeric EXTENSION;
 * whoever wants to reach them dials the shared number, then enters the
 * extension when prompted (see TwilioProvider.buildExtensionPromptResponse
 * and routes/voice.ts's /extension endpoint).
 *
 * Premium/Business users skip all of this and get a real dedicated
 * number via TwilioProvider.provisionNumber() instead — the whole point
 * of paying is not having to hand out an extension.
 */

export const EXTENSION_DIGITS = 4;

/**
 * TODO: read from env/config once deployed (SHARED_TOLLFREE_NUMBER) and
 * from the actual provisioned number's record, not a literal here.
 */
export const SHARED_TOLLFREE_NUMBER = process.env.SHARED_TOLLFREE_NUMBER ?? "+18005550100";

function randomExtension(): string {
  const max = 10 ** EXTENSION_DIGITS;
  return Math.floor(Math.random() * max)
    .toString()
    .padStart(EXTENSION_DIGITS, "0");
}

/**
 * Generates a new extension for a free-tier user, retrying on collision.
 * TODO: back this with a real uniqueness check against the numbers table
 * (`SELECT 1 FROM numbers WHERE e164 = SHARED_TOLLFREE_NUMBER AND
 * extension = $1`) instead of the in-memory Set stub below.
 */
const ASSIGNED_EXTENSIONS_STUB = new Set<string>();

export async function assignExtension(): Promise<string> {
  let candidate = randomExtension();
  let attempts = 0;
  while (ASSIGNED_EXTENSIONS_STUB.has(candidate) && attempts < 20) {
    candidate = randomExtension();
    attempts++;
  }
  if (ASSIGNED_EXTENSIONS_STUB.has(candidate)) {
    throw new Error("Extension pool exhausted for this digit length — consider increasing EXTENSION_DIGITS.");
  }
  ASSIGNED_EXTENSIONS_STUB.add(candidate);
  return candidate;
}

export interface ExtensionLookupResult {
  destinationE164: string;
  destinationVerified: boolean;
  subscriptionTier: "free" | "premium" | "business";
}

/**
 * Resolves an extension entered by a caller to the user's forwarding
 * destination. TODO: replace with a real DB query:
 * `SELECT destination_e164, destination_verified, u.subscription_tier
 *  FROM numbers n JOIN users u ON u.id = n.user_id
 *  WHERE n.e164 = SHARED_TOLLFREE_NUMBER AND n.extension = $1`
 */
export async function resolveExtension(extension: string): Promise<ExtensionLookupResult | null> {
  // Placeholder for local development/testing only.
  if (extension === "0000") {
    return { destinationE164: "+15555550123", destinationVerified: true, subscriptionTier: "free" };
  }
  return null;
}
