import * as Contacts from "expo-contacts";

/**
 * Matches call-history numbers against the device's own contacts —
 * free, private (nothing leaves the device), and works for any contact
 * the person already has, unlike CNAM lookup services (Twilio Lookup's
 * caller-name package), which are US-only and cost money per lookup.
 * The tradeoff: it can only ever resolve numbers already in the
 * person's contacts, never an unknown caller's actual name.
 *
 * Number matching is intentionally simple: compares the LAST 10 DIGITS
 * of each number, after stripping all non-digit characters. This treats
 * "+15555550123", "(555) 555-0123", and "5555550123" as the same
 * number, which covers the common case well but isn't fully correct for
 * numbers shorter than 10 digits (some non-US regions) or where a
 * country code genuinely changes which number is meant. A proper E.164
 * parser (e.g. libphonenumber) would be worth swapping in before launch.
 */

interface ContactEntry {
  name: string;
  normalizedNumbers: string[];
}

let cachedContacts: ContactEntry[] | null = null;
let cachedContactsPromise: Promise<ContactEntry[]> | null = null;

function normalizeNumber(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  return digitsOnly.slice(-10);
}

async function loadContacts(): Promise<ContactEntry[]> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== "granted") return [];

  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });

  return data
    .filter((contact) => contact.name && contact.phoneNumbers?.length)
    .map((contact) => ({
      name: contact.name!,
      normalizedNumbers: contact.phoneNumbers!.map((p) => normalizeNumber(p.number ?? "")).filter(Boolean),
    }));
}

/**
 * Loads (and caches for the app session) the device's contacts. Call
 * this once, e.g. when the Calls tab mounts, rather than on every
 * render — contact lists can be large, and permission prompts should
 * only ever appear when the person is actually looking at something
 * that needs it.
 */
export async function ensureContactsLoaded(): Promise<void> {
  if (cachedContacts) return;
  if (!cachedContactsPromise) {
    cachedContactsPromise = loadContacts().then((contacts) => {
      cachedContacts = contacts;
      return contacts;
    });
  }
  await cachedContactsPromise;
}

/** Returns the matching contact's name, or null if no contact matches (or contacts haven't loaded / permission was denied). */
export function resolveCallerName(phoneNumber: string): string | null {
  if (!cachedContacts) return null;
  const normalized = normalizeNumber(phoneNumber);
  if (!normalized) return null;

  const match = cachedContacts.find((contact) => contact.normalizedNumbers.includes(normalized));
  return match?.name ?? null;
}

/** Clears the cache — call if contacts permission is granted after an earlier denial, so a retry actually re-fetches. */
export function resetContactsCache(): void {
  cachedContacts = null;
  cachedContactsPromise = null;
}
