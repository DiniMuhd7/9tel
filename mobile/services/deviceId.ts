import AsyncStorage from "@react-native-async-storage/async-storage";

const DEVICE_ID_KEY = "9tel-device-id";

function generateId(): string {
  // Good enough for a per-install guest identifier. Swap for a real
  // vendor/hardware ID (e.g. expo-application's androidId /
  // getIosIdForVendorAsync, or expo-crypto's randomUUID) before shipping
  // — this is intentionally dependency-free for the skeleton.
  return `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Persists a device ID across app opens so the same guest session resumes. */
export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = generateId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}
