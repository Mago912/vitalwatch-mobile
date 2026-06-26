import AsyncStorage from '@react-native-async-storage/async-storage';

import type { EventItem, Medication, UserProfile } from '@/constants/vitalwatch';

const PROFILE_KEY = 'vitalwatch.profile';
const MEDICATIONS_KEY = 'vitalwatch.medications';
const HISTORY_KEY = 'vitalwatch.history';

// Lee un valor guardado. Si no existe o hay error, devuelve el valor inicial.
async function loadJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const rawValue = await AsyncStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallback;
  } catch {
    return fallback;
  }
}

async function saveJson<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export function loadProfile(fallback: UserProfile) {
  return loadJson(PROFILE_KEY, fallback);
}

export function saveProfile(profile: UserProfile) {
  return saveJson(PROFILE_KEY, profile);
}

export function loadMedications(fallback: Medication[]) {
  return loadJson(MEDICATIONS_KEY, fallback);
}

export function saveMedications(medications: Medication[]) {
  return saveJson(MEDICATIONS_KEY, medications);
}

export function loadHistory(fallback: EventItem[]) {
  return loadJson(HISTORY_KEY, fallback);
}

export function saveHistory(history: EventItem[]) {
  return saveJson(HISTORY_KEY, history);
}
