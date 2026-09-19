import '@supabase/functions-js/edge-runtime.d.ts';
import { withSupabase } from '@supabase/server';

type TelemetryEvent = 'fall_detected' | 'sos';

type DeviceTelemetryPayload = {
  batteryLevel?: number | null;
  deviceCode: string;
  event?: TelemetryEvent;
  eventId?: string;
  eventOccurredAt?: number;
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
        .select('id, device_token_hash, connection_status')
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
        connection_status: 'online',
        last_seen_at: recordedAt,
        performance_mode: payload.performanceMode ?? false,
      };

      if (device.connection_status !== 'online') {
        deviceUpdate.connection_status_changed_at = recordedAt;
      }

      if (payload.batteryLevel !== null && payload.batteryLevel !== undefined) {
        deviceUpdate.current_battery = payload.batteryLevel;
      }

      const { error: updateError } = await context.supabaseAdmin
        .from('devices')
        .update(deviceUpdate)
        .eq('id', device.id);

      if (updateError) throw updateError;

      if (device.connection_status === 'offline') {
        const { error: recoveryError } = await context.supabaseAdmin.from('device_events').insert({
          device_id: device.id,
          type: 'device_online',
          severity: 'info',
          message: 'La pulsera volvio a comunicarse con Supabase.',
          event_time: recordedAt,
        });
        if (recoveryError) throw recoveryError;
      }

      if (payload.event) {
        const eventDefinition = TELEMETRY_EVENTS[payload.event];
        const eventTime = payload.eventOccurredAt
          ? new Date(payload.eventOccurredAt * 1000).toISOString()
          : recordedAt;
        const eventRow = {
          device_id: device.id,
          source_event_id: payload.eventId ?? null,
          type: payload.event,
          severity: eventDefinition.severity,
          message: eventDefinition.message,
          heart_rate: payload.heartRate ?? null,
          spo2: payload.spo2 ?? null,
          battery_level: payload.batteryLevel ?? null,
          impact_value: payload.impactValue ?? null,
          event_time: eventTime,
        };
        const eventQuery = payload.eventId
          ? context.supabaseAdmin
              .from('device_events')
              .upsert(eventRow, { onConflict: 'device_id,source_event_id', ignoreDuplicates: true })
          : context.supabaseAdmin.from('device_events').insert(eventRow);
        const { error: eventError } = await eventQuery;

        if (eventError) throw eventError;
      }

      const confirmedAlerts = await createConfirmedVitalAlerts(
        context.supabaseAdmin,
        device.id,
        recordedAt
      );

      return jsonResponse({ ok: true, recordedAt, confirmedAlerts });
    } catch (error) {
      console.error('vitalwatch-device-telemetry:', getErrorMessage(error));
      return jsonResponse({ error: 'No se pudo guardar la telemetria de la pulsera.' }, 500);
    }
  }),
};

// Umbrales de demostracion configurables. No representan diagnostico medico.
// Una alerta exige tres lecturas validas consecutivas y tiene 10 minutos de
// espera para evitar mensajes repetidos por el mismo episodio.
const VITAL_CONFIRMATION = {
  samples: 3,
  windowMs: 30_000,
  cooldownMs: 10 * 60_000,
  heartRateLow: 50,
  heartRateHigh: 110,
  spo2Low: 92,
};

async function createConfirmedVitalAlerts(
  supabaseAdmin: any,
  deviceId: number,
  recordedAt: string
) {
  const windowStart = new Date(Date.parse(recordedAt) - VITAL_CONFIRMATION.windowMs).toISOString();
  const { data: readings, error: readingsError } = await supabaseAdmin
    .from('sensor_readings')
    .select('heart_rate, spo2, battery_level, impact_value, recorded_at')
    .eq('device_id', deviceId)
    .gte('recorded_at', windowStart)
    .order('recorded_at', { ascending: false })
    .limit(VITAL_CONFIRMATION.samples);
  if (readingsError) throw readingsError;
  if (!readings || readings.length < VITAL_CONFIRMATION.samples) return [];

  const definitions = [
    {
      type: 'heart_rate_abnormal',
      confirmed: readings.every(
        (reading: { heart_rate: number | null }) =>
          typeof reading.heart_rate === 'number' &&
          (reading.heart_rate < VITAL_CONFIRMATION.heartRateLow ||
            reading.heart_rate > VITAL_CONFIRMATION.heartRateHigh)
      ),
      message: 'Tres lecturas consecutivas de frecuencia cardiaca quedaron fuera del rango experimental.',
    },
    {
      type: 'spo2_low',
      confirmed: readings.every(
        (reading: { spo2: number | null }) =>
          typeof reading.spo2 === 'number' && reading.spo2 < VITAL_CONFIRMATION.spo2Low
      ),
      message: 'Tres lecturas consecutivas de SpO2 quedaron bajo el rango experimental.',
    },
  ];
  const created: string[] = [];

  for (const definition of definitions) {
    if (!definition.confirmed) continue;

    const cooldownStart = new Date(Date.parse(recordedAt) - VITAL_CONFIRMATION.cooldownMs).toISOString();
    const { data: recentEvent, error: recentError } = await supabaseAdmin
      .from('device_events')
      .select('id')
      .eq('device_id', deviceId)
      .eq('type', definition.type)
      .gte('event_time', cooldownStart)
      .limit(1)
      .maybeSingle();
    if (recentError) throw recentError;
    if (recentEvent) continue;

    const newest = readings[0];
    const { error: eventError } = await supabaseAdmin.from('device_events').insert({
      device_id: deviceId,
      type: definition.type,
      severity: 'critical',
      message: definition.message,
      heart_rate: newest.heart_rate,
      spo2: newest.spo2,
      battery_level: newest.battery_level,
      impact_value: newest.impact_value,
      event_time: recordedAt,
    });
    if (eventError) throw eventError;
    created.push(definition.type);
  }

  return created;
}

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
    value.eventId !== undefined &&
    (typeof value.eventId !== 'string' || value.eventId.length < 8 || value.eventId.length > 100)
  ) {
    return false;
  }
  if (
    value.eventOccurredAt !== undefined &&
    (typeof value.eventOccurredAt !== 'number' ||
      !Number.isInteger(value.eventOccurredAt) ||
      value.eventOccurredAt < 1_700_000_000 ||
      value.eventOccurredAt > Date.now() / 1000 + 300)
  ) {
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
