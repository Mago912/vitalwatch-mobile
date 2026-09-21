export const DEFAULT_MEDICATION_DAYS = [1, 2, 3, 4, 5, 6, 7];

export const MEDICATION_WEEKDAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mie' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sab' },
  { value: 7, label: 'Dom' },
];

export type MedicationOccurrence = {
  date: string;
  iso: string;
  timestamp: number;
};

export function normalizeMedicationDays(days?: number[]) {
  const normalized = Array.from(
    new Set((days ?? DEFAULT_MEDICATION_DAYS).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))
  ).sort((left, right) => left - right);

  return normalized.length > 0 ? normalized : [...DEFAULT_MEDICATION_DAYS];
}

export function medicationDaysLabel(days?: number[]) {
  const selected = normalizeMedicationDays(days);
  return MEDICATION_WEEKDAYS.filter((day) => selected.includes(day.value))
    .map((day) => day.label)
    .join(', ');
}

export function getMedicationOccurrences(
  startDate: string,
  time: string,
  days?: number[],
  now = new Date(),
  amount = 3
): MedicationOccurrence[] {
  const selectedDays = normalizeMedicationDays(days);
  const today = currentArgentinaDate(now);
  // Si la fecha de inicio ya paso, buscamos desde hoy. Si es futura, esperamos
  // hasta ese dia antes de calcular las repeticiones semanales.
  const startOffset = Math.max(0, differenceInDays(startDate, today));
  const occurrences: MedicationOccurrence[] = [];

  for (let offset = startOffset; offset <= startOffset + 21 && occurrences.length < amount; offset += 1) {
    const date = addDays(today, offset);
    if (date < startDate || !selectedDays.includes(isoWeekday(date))) continue;

    const iso = scheduledDateTimeToIso(date, time);
    const timestamp = new Date(iso).getTime();
    const isCurrentReminderWindow = timestamp <= now.getTime() && now.getTime() < timestamp + 6 * 60 * 60 * 1000;

    if (timestamp >= now.getTime() || isCurrentReminderWindow) {
      occurrences.push({ date, iso, timestamp });
    }
  }

  return occurrences;
}

export function getCurrentMedicationOccurrence(
  startDate: string,
  time: string,
  days?: number[],
  now = new Date()
) {
  return getMedicationOccurrences(startDate, time, days, now, 1)[0] ?? null;
}

export function currentArgentinaDate(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function scheduledDateTimeToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function addDays(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function differenceInDays(left: string, right: string) {
  const leftTime = new Date(`${left}T12:00:00Z`).getTime();
  const rightTime = new Date(`${right}T12:00:00Z`).getTime();
  return Math.floor((leftTime - rightTime) / 86_400_000);
}

function isoWeekday(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}
