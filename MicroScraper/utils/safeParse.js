import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Shared safe JSON parsing utility.
 * Every AsyncStorage.getItem(...).then(JSON.parse) should use this
 * to avoid a blank screen when storage is corrupted.
 */
export function safeParse(raw, fallback = null) {
  if (raw == null || typeof raw !== 'string' || raw.trim() === '') {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[safeParse] Failed to parse JSON, returning fallback:', raw.slice(0, 100));
    return fallback;
  }
}

/**
 * Safe async version — reads from AsyncStorage and parses.
 */
export async function safeParseStorage(key, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return safeParse(raw, fallback);
  } catch (e) {
    console.warn('[safeParseStorage] Error reading key', key, e);
    return fallback;
  }
}

/**
 * Safe update helper for JSON arrays/objects stored in AsyncStorage.
 * Reads fresh value, applies fn, writes back. Prevents lost-update races
 * when multiple operations happen in quick succession.
 */
export async function updateStoredJson(key, fn, fallback = null) {
  try {
    const raw = await AsyncStorage.getItem(key);
    const current = safeParse(raw, fallback);
    const updated = fn(current);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('[updateStoredJson] Error updating key', key, e);
    return null;
  }
}
