import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

type TelemetryEvent = 'fall_detected' | 'sos';

type DeviceTelemetryPayload = {
  batteryLevel?: number | null;
  deviceCode: string;
  event?: TelemetryEvent;
  heartRate?: number | null;
  impactValue?: number | null;
  performanceMode?: boolean;
  spo2?: number | null;
};

export default {
  fetch: withSupabase({ auth: ['publishable'] }, async (request, context) => {
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Metodo no permitido.' }, 405);
    }

    try {
      const payload: unknown = await request.json();
      if (!isTelemetryPayload(payload)) {
        return jsonResponse({ error: 'Telemetria de dispositivo invalida.' }, 400);
      }

      const { data: device, error: deviceError } = await context.supabaseAdmin
        .from('devices')
        .select('id, device_token_hash')
        .eq('device_code', payload.deviceCode.trim())
        .maybeSingle();

      if (deviceError) throw deviceError;
      if (!device?.device_token_hash) {
        return jsonResponse({ error: 'Pulsera no registrada.' }, 404);
      }

      const receivedToken = request.headers.get('x-device-token');
      if (!receivedToken || !safeEqual(await sha256(receivedToken), device.device_token_hash)) {
        return jsonResponse({ error: 'Credencial de pulsera invalida.' }, 401);
      }

      const recordedAt = new Date().toISOString();
      const reading = {
        device_id: device.id,
        heart_rate: payload.heartRate ?? null,
        spo2: payload.spo2 ?? null,
        battery_level: payload.batteryLevel ?? null,
        impact_value: payload.impactValue ?? null,
        performance_mode: payload.performanceMode ?? false,
        recorded_at: recordedAt,
      };

      const { error: readingError } = await context.supabaseAdmin
        .from('sensor_readings')
        .insert(reading);

      if (readingError) throw readingError;

      const deviceUpdate: Record<string, unknown> = {
        last_seen_at: recordedAt,
        performance_mode: payload.performanceMode ?? false,
      };

      if (payload.batteryLevel !== null && payload.batteryLevel !== undefined) {
        deviceUpdate.current_battery = payload.batteryLevel;
      }

      const { error: updateError } = await context.supabaseAdmin
        .from('devices')
        .update(deviceUpdate)
        .eq('id', device.id);

      if (updateError) throw updateError;

      if (payload.event) {
        const eventDefinition = TELEMETRY_EVENTS[payload.event];
        const { error: eventError } = await context.supabaseAdmin.from('device_events').insert({
          device_id: device.id,
          type: payload.event,
          severity: eventDefinition.severity,
          message: eventDefinition.message,
          heart_rate: payload.heartRate ?? null,
          spo2: payload.spo2 ?? null,
          battery_level: payload.batteryLevel ?? null,
          impact_value: payload.impactValue ?? null,
          event_time: recordedAt,
        });

        if (eventError) throw eventError;
      }

      return jsonResponse({ ok: true, recordedAt });
    } catch (error) {
      console.error('vitalwatch-device-telemetry:', getErrorMessage(error));
      return jsonResponse({ error: 'No se pudo guardar la telemetria de la pulsera.' }, 500);
    }
  }),
};

const TELEMETRY_EVENTS: Record<
  TelemetryEvent,
  { message: string; severity: 'critical' }
> = {
  fall_detected: {
    message: 'Posible caida detectada por la pulsera.',
    severity: 'critical',
  },
  sos: {
    message: 'SOS activado desde la pulsera.',
    severity: 'critical',
  },
};

function isTelemetryPayload(payload: unknown): payload is DeviceTelemetryPayload {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Partial<DeviceTelemetryPayload>;

  if (
    typeof value.deviceCode !== 'string' ||
    value.deviceCode.trim().length === 0 ||
    value.deviceCode.length > 100
  ) {
    return false;
  }

  if (!isOptionalNumberInRange(value.heartRate, 30, 240)) return false;
  if (!isOptionalNumberInRange(value.spo2, 70, 100)) return false;
  if (!isOptionalNumberInRange(value.batteryLevel, 0, 100)) return false;
  if (!isOptionalNumberInRange(value.impactValue, 0, 32)) return false;
  if (value.performanceMode !== undefined && typeof value.performanceMode !== 'boolean') {
    return false;
  }
  if (
    value.event !== undefined &&
    value.event !== 'fall_detected' &&
    value.event !== 'sos'
  ) {
    return false;
  }

  return (
    value.event !== undefined ||
    typeof value.heartRate === 'number' ||
    typeof value.spo2 === 'number' ||
    typeof value.batteryLevel === 'number' ||
    typeof value.impactValue === 'number'
  );
}

function isOptionalNumberInRange(
  value: number | null | undefined,
  minimum: number,
  maximum: number
) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum)
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
