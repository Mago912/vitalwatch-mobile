import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

type DevicePayload = {
  action: 'list' | 'set_status';
  deviceCode: string;
  reportedDisplayOn?: boolean;
  reportedDisplayView?: DisplayView;
  medicationId?: number;
  status?: 'taken';
};

type DisplayView = 'menu' | 'vitals' | 'movement' | 'status' | 'medication';

type MedicationRow = {
  dose: string;
  id: number;
  name: string;
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
          'id, user_id, device_token_hash, desired_display_on, desired_display_view, display_command_at'
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

      if (payload.reportedDisplayOn !== undefined || payload.reportedDisplayView !== undefined) {
        const displayReport: Record<string, boolean | string> = {
          display_reported_at: new Date().toISOString(),
        };
        if (payload.reportedDisplayOn !== undefined) {
          displayReport.reported_display_on = payload.reportedDisplayOn;
        }
        if (payload.reportedDisplayView !== undefined) {
          displayReport.reported_display_view = payload.reportedDisplayView;
        }

        const { error: reportError } = await context.supabaseAdmin
          .from('devices')
          .update(displayReport)
          .eq('id', device.id);

        if (reportError) throw reportError;
      }

      if (payload.action === 'set_status') {
        await markMedicationTaken(context.supabaseAdmin, device, payload.medicationId!);
      }

      const medications = await listMedications(context.supabaseAdmin, device.user_id);
      return jsonResponse({
        control: {
          commandAt: device.display_command_at,
          displayOn: device.desired_display_on ?? true,
          displayView: device.desired_display_view ?? 'menu',
        },
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
    .select('id, name, dose, scheduled_time')
    .eq('user_id', userId)
    .eq('active', true)
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

  const today = argentinaDateKey(new Date().toISOString());
  const latestStatus = new Map<number, string>();

  for (const log of (logRows ?? []) as MedicationLogRow[]) {
    const statusDate = log.taken_at ?? log.scheduled_for ?? log.created_at;
    if (!latestStatus.has(log.medication_id) && argentinaDateKey(statusDate) === today) {
      latestStatus.set(log.medication_id, log.status);
    }
  }

  return medications.map((medication) => ({
    id: String(medication.id),
    name: medication.name,
    dose: medication.dose,
    time: medication.scheduled_time.slice(0, 5),
    status: latestStatus.get(medication.id) === 'taken' ? 'Tomado' : 'Pendiente',
  }));
}

async function markMedicationTaken(
  supabaseAdmin: any,
  device: { id: number; user_id: number },
  medicationId: number
) {
  const { data: medication, error: medicationError } = await supabaseAdmin
    .from('medications')
    .select('id, name')
    .eq('id', medicationId)
    .eq('user_id', device.user_id)
    .eq('active', true)
    .maybeSingle();

  if (medicationError) throw medicationError;
  if (!medication) throw new Error('Medicamento no encontrado.');

  const now = new Date().toISOString();
  const { error: logError } = await supabaseAdmin.from('medication_logs').insert({
    medication_id: medication.id,
    device_id: device.id,
    scheduled_for: now,
    taken_at: now,
    status: 'taken',
    source: 'esp32',
  });

  if (logError) throw logError;

  const { error: eventError } = await supabaseAdmin.from('device_events').insert({
    device_id: device.id,
    type: 'medication_taken',
    severity: 'info',
    message: `${medication.name} fue marcado como tomado desde la pulsera.`,
    event_time: now,
  });

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
    (value.reportedDisplayView === undefined || isDisplayView(value.reportedDisplayView));

  if (!baseIsValid) return false;
  if (value.action === 'list') return true;

  return (
    value.action === 'set_status' &&
    value.status === 'taken' &&
    Number.isInteger(value.medicationId)
  );
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

function argentinaDateKey(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
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
