import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

type DevicePayload = {
  action: 'control' | 'list' | 'set_status';
  deviceCode: string;
  reportedDisplayOn?: boolean;
  reportedDisplayView?: DisplayView;
  reportedAlertState?: AlertState;
  reportedInputHandled?: boolean;
  medicationId?: number;
  status?: 'pending' | 'taken';
};

type DisplayView = 'menu' | 'vitals' | 'movement' | 'status' | 'medication';
type AlertState = 'none' | 'fall' | 'sos';

type MedicationRow = {
  dose: string;
  id: number;
  name: string;
  scheduled_date: string;
  scheduled_days: number[] | null;
  scheduled_time: string;
};

type MedicationLogRow = {
  created_at: string;
  medication_id: number;
  scheduled_for: string;
  status: string;
  taken_at: string | null;
};

export default {
  fetch: withSupabase({ auth: ['publishable'] }, async (request, context) => {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Metodo no permitido.' }, 405);
    }

    try {
      const payload: unknown = await request.json();
      if (!isDevicePayload(payload)) {
        return jsonResponse({ error: 'Solicitud de dispositivo invalida.' }, 400);
      }

      const { data: device, error: deviceError } = await context.supabaseAdmin
        .from('devices')
        .select(
          'id, user_id, device_token_hash, desired_display_on, desired_display_view, display_command_at, desired_input_action, input_command_at, input_reported_at'
        )
        .eq('device_code', payload.deviceCode.trim())
        .maybeSingle();

      if (deviceError) {
        throw deviceError;
      }

      if (!device?.device_token_hash) {
        return jsonResponse({ error: 'Pulsera no registrada.' }, 404);
      }

      const receivedToken = request.headers.get('x-device-token');
      if (!receivedToken || !safeEqual(await sha256(receivedToken), device.device_token_hash)) {
        return jsonResponse({ error: 'Credencial de pulsera invalida.' }, 401);
      }

      if (
        payload.reportedDisplayOn !== undefined ||
        payload.reportedDisplayView !== undefined ||
        payload.reportedAlertState !== undefined ||
        payload.reportedInputHandled === true
      ) {
        const displayReport: Record<string, boolean | string> = {
          display_reported_at: new Date().toISOString(),
        };
        if (payload.reportedDisplayOn !== undefined) {
          displayReport.reported_display_on = payload.reportedDisplayOn;
        }
        if (payload.reportedDisplayView !== undefined) {
          displayReport.reported_display_view = payload.reportedDisplayView;
        }
        if (payload.reportedAlertState !== undefined) {
          displayReport.reported_alert_state = payload.reportedAlertState;
          displayReport.alert_reported_at = new Date().toISOString();
        }
        if (payload.reportedInputHandled === true) {
          displayReport.input_reported_at = new Date().toISOString();
        }

        const { error: reportError } = await context.supabaseAdmin
          .from('devices')
          .update(displayReport)
          .eq('id', device.id);

        if (reportError) throw reportError;
      }

      if (payload.action === 'set_status') {
        await markMedicationStatus(
          context.supabaseAdmin,
          device,
          payload.medicationId!,
          payload.status!
        );
      }

      const inputIsPending =
        payload.reportedInputHandled !== true &&
        device.input_command_at !== null &&
        (device.input_reported_at === null ||
          new Date(device.input_reported_at).getTime() <
            new Date(device.input_command_at).getTime());
      const control = {
        commandAt: device.display_command_at,
        displayOn: device.desired_display_on ?? true,
        displayView: device.desired_display_view ?? 'menu',
        inputAction: inputIsPending ? device.desired_input_action : null,
      };

      if (payload.action === 'control') {
        return jsonResponse({ control });
      }

      const medications = await listMedications(context.supabaseAdmin, device.user_id);
      return jsonResponse({
        control,
        medications,
      });
    } catch (error) {
      console.error('vitalwatch-device-medications:', getErrorMessage(error));
      return jsonResponse({ error: 'No se pudo procesar la solicitud de la pulsera.' }, 500);
    }
  }),
};

async function listMedications(supabaseAdmin: any, userId: number) {
  const { data: medicationRows, error: medicationsError } = await supabaseAdmin
    .from('medications')
    .select('id, name, dose, scheduled_date, scheduled_days, scheduled_time')
    .eq('user_id', userId)
    .eq('active', true)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true });

  if (medicationsError) throw medicationsError;
  const medications = (medicationRows ?? []) as MedicationRow[];
  if (medications.length === 0) return [];

  const { data: logRows, error: logsError } = await supabaseAdmin
    .from('medication_logs')
    .select('medication_id, scheduled_for, taken_at, status, created_at')
    .in('medication_id', medications.map((medication) => medication.id))
    .order('created_at', { ascending: false })
    .limit(200);

  if (logsError) throw logsError;

  const logs = (logRows ?? []) as MedicationLogRow[];
  const now = new Date();

  return medications.map((medication) => {
    const days = normalizeMedicationDays(medication.scheduled_days);
    const occurrences = getMedicationOccurrences(
      medication.scheduled_date,
      medication.scheduled_time.slice(0, 5),
      days,
      now,
      3
    );
    const occurrence = occurrences[0];
    const status = occurrence
      ? getOccurrenceStatus(logs, medication.id, occurrence.iso)
      : 'pending';

    return {
      id: String(medication.id),
      name: medication.name,
      dose: medication.dose,
      date: occurrence?.date ?? medication.scheduled_date,
      time: medication.scheduled_time.slice(0, 5),
      days,
      status: status === 'taken' ? 'Tomado' : 'Pendiente',
      reminderDue:
        status !== 'taken' && occurrence !== undefined && isReminderDue(occurrence.timestamp, now),
    };
  });
}

async function markMedicationStatus(
  supabaseAdmin: any,
  device: { id: number; user_id: number },
  medicationId: number,
  status: 'pending' | 'taken'
) {
  const { data: medication, error: medicationError } = await supabaseAdmin
    .from('medications')
    .select('id, name, dose, scheduled_date, scheduled_days, scheduled_time')
    .eq('id', medicationId)
    .eq('user_id', device.user_id)
    .eq('active', true)
    .maybeSingle();

  if (medicationError) throw medicationError;
  if (!medication) throw new Error('Medicamento no encontrado.');

  const now = new Date();
  const occurrence = getMedicationOccurrences(
    medication.scheduled_date,
    medication.scheduled_time.slice(0, 5),
    medication.scheduled_days,
    now,
    1
  )[0];
  if (!occurrence) throw new Error('No hay una proxima toma programada.');

  const nowIso = now.toISOString();
  const { error: logError } = await supabaseAdmin.from('medication_logs').insert({
    medication_id: medication.id,
    device_id: device.id,
    scheduled_for: occurrence.iso,
    taken_at: status === 'taken' ? nowIso : null,
    status,
    source: 'esp32',
  });

  if (logError) throw logError;

  if (status !== 'taken') return;

  const { error: eventError } = await supabaseAdmin.from('device_events').upsert(
    {
      device_id: device.id,
      type: 'medication_taken',
      severity: 'info',
      message: `${medication.name}${medication.dose ? ` (${medication.dose})` : ''} fue marcado como tomado desde la pulsera.`,
      event_time: nowIso,
      source_event_id: `medication-taken:${medication.id}:${Math.floor(
        new Date(occurrence.iso).getTime() / 1000
      )}`,
    },
    { ignoreDuplicates: true, onConflict: 'device_id,source_event_id' }
  );

  if (eventError) throw eventError;
}

function isDevicePayload(payload: unknown): payload is DevicePayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<DevicePayload>;
  const baseIsValid =
    typeof value.deviceCode === 'string' &&
    value.deviceCode.trim().length > 0 &&
    value.deviceCode.length <= 100 &&
    (value.reportedDisplayOn === undefined ||
      typeof value.reportedDisplayOn === 'boolean') &&
    (value.reportedDisplayView === undefined || isDisplayView(value.reportedDisplayView)) &&
    (value.reportedAlertState === undefined || isAlertState(value.reportedAlertState)) &&
    (value.reportedInputHandled === undefined ||
      typeof value.reportedInputHandled === 'boolean');

  if (!baseIsValid) return false;
  if (value.action === 'control' || value.action === 'list') return true;

  return (
    value.action === 'set_status' &&
    (value.status === 'pending' || value.status === 'taken') &&
    Number.isInteger(value.medicationId)
  );
}

const DEFAULT_MEDICATION_DAYS = [1, 2, 3, 4, 5, 6, 7];

function normalizeMedicationDays(days: number[] | null | undefined) {
  const normalized = Array.from(
    new Set((days ?? DEFAULT_MEDICATION_DAYS).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))
  ).sort((left, right) => left - right);
  return normalized.length > 0 ? normalized : [...DEFAULT_MEDICATION_DAYS];
}

function getMedicationOccurrences(
  startDate: string,
  time: string,
  days: number[] | null | undefined,
  now: Date,
  amount: number
) {
  const selectedDays = normalizeMedicationDays(days);
  const today = currentArgentinaDate(now);
  const startOffset = Math.max(0, differenceInDays(startDate, today));
  const occurrences: Array<{ date: string; iso: string; timestamp: number }> = [];

  for (let offset = startOffset; offset <= startOffset + 21 && occurrences.length < amount; offset += 1) {
    const date = addDays(today, offset);
    if (date < startDate || !selectedDays.includes(isoWeekday(date))) continue;

    const iso = scheduledDateTimeToIso(date, time);
    const timestamp = new Date(iso).getTime();
    const isCurrentReminderWindow =
      timestamp <= now.getTime() && now.getTime() < timestamp + 6 * 60 * 60 * 1000;

    if (timestamp >= now.getTime() || isCurrentReminderWindow) {
      occurrences.push({ date, iso, timestamp });
    }
  }

  return occurrences;
}

function getOccurrenceStatus(logs: MedicationLogRow[], medicationId: number, iso: string) {
  const expectedSchedule = new Date(iso).getTime();
  const matchingLog = logs.find(
    (log) =>
      log.medication_id === medicationId &&
      Math.abs(new Date(log.scheduled_for).getTime() - expectedSchedule) <= 60_000
  );
  return matchingLog?.status ?? 'pending';
}

function isReminderDue(timestamp: number, now: Date) {
  return now.getTime() >= timestamp && now.getTime() < timestamp + 6 * 60 * 60 * 1000;
}

function scheduledDateTimeToIso(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`).toISOString();
}

function currentArgentinaDate(value: Date) {
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

function isAlertState(value: unknown): value is AlertState {
  return value === 'none' || value === 'fall' || value === 'sos';
}

function isDisplayView(value: unknown): value is DisplayView {
  return (
    value === 'menu' ||
    value === 'vitals' ||
    value === 'movement' ||
    value === 'status' ||
    value === 'medication'
  );
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object') return JSON.stringify(error);
  return String(error);
}
