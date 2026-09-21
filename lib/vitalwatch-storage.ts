import AsyncStorage from '@react-native-async-storage/async-storage';

import { currentArgentinaDate } from '@/constants/vitalwatch';
import { DEFAULT_MEDICATION_DAYS, normalizeMedicationDays } from '@/lib/medication-schedule';
import type {
  EmergencyContact,
  EventItem,
  Medication,
  UserProfile,
} from '@/constants/vitalwatch';

const PROFILE_KEY = 'vitalwatch.profile';
const MEDICATIONS_KEY = 'vitalwatch.medications';
const HISTORY_KEY = 'vitalwatch.history';
const EMERGENCY_CONTACTS_KEY = 'vitalwatch.emergencyContacts';

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

export async function loadMedications(fallback: Medication[]) {
  const medications = await loadJson<Medication[]>(MEDICATIONS_KEY, fallback);
  return medications.map((medication) => ({
    ...medication,
    date: medication.date || currentArgentinaDate(),
    days: normalizeMedicationDays(medication.days ?? DEFAULT_MEDICATION_DAYS),
  }));
}

export function saveMedications(medications: Medication[]) {
  return saveJson(MEDICATIONS_KEY, medications);
}

export async function loadHistory(fallback: EventItem[]) {
  const history = await loadJson<EventItem[]>(HISTORY_KEY, fallback);
  // Elimina únicamente el evento fijo que traía la plantilla inicial.
  return history.filter((event) => event.id !== 'event-demo-1');
}

export function saveHistory(history: EventItem[]) {
  return saveJson(HISTORY_KEY, history);
}

export function loadEmergencyContacts(fallback: EmergencyContact[]) {
  return loadJson(EMERGENCY_CONTACTS_KEY, fallback);
}

export function saveEmergencyContacts(contacts: EmergencyContact[]) {
  return saveJson(EMERGENCY_CONTACTS_KEY, contacts);
}
