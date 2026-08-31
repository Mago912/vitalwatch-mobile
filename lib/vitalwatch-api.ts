import { DeviceDisplayView } from '@/constants/vitalwatch';
import { supabase } from '@/lib/supabase';

export type DashboardEvent = {
  eventTime: string;
  id: number;
  message: string;
  severity: string;
  type: string;
};

export type DashboardSnapshot = {
  device: {
    battery: number | null;
    code: string;
    displayCommandAt: string | null;
    displayReportedAt: string | null;
    desiredDisplayOn: boolean;
    desiredDisplayView: DeviceDisplayView;
    id: number;
    name: string;
    reportedDisplayOn: boolean | null;
    reportedDisplayView: DeviceDisplayView | null;
  };
  events: DashboardEvent[];
  latestReading: {
    battery: number | null;
    heartRate: number | null;
    impact: number | null;
    oxygen: number | null;
    recordedAt: string;
  } | null;
  user: {
    contactName: string;
    id: number;
    name: string;
  };
};

export async function fetchDashboardSnapshot(): Promise<DashboardSnapshot> {
  const userResult = await supabase
    .from('users')
    .select('id, name, responsible_contact')
    .limit(1)
    .maybeSingle();

  if (userResult.error) {
    throw new Error(`No se pudo leer users: ${userResult.error.message}`);
  }

  if (!userResult.data) {
    throw new Error('Esta cuenta todavia no tiene un usuario VitalWatch vinculado.');
  }

  const userId = userResult.data.id;
  const deviceResult = await supabase
    .from('devices')
    .select(
      'id, name, device_code, current_battery, desired_display_on, desired_display_view, reported_display_on, reported_display_view, display_command_at, display_reported_at'
    )
    .eq('user_id', userId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (deviceResult.error) {
    throw new Error(`No se pudo leer devices: ${deviceResult.error.message}`);
  }

  if (!deviceResult.data) {
    throw new Error('Esta cuenta no tiene una pulsera disponible.');
  }

  const deviceId = deviceResult.data.id;
  const [readingResult, eventsResult] = await Promise.all([
    supabase
      .from('sensor_readings')
      .select('heart_rate, spo2, battery_level, impact_value, recorded_at')
      .eq('device_id', deviceId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('device_events')
      .select('id, type, severity, message, event_time')
      .eq('device_id', deviceId)
      .order('event_time', { ascending: false })
      .limit(40),
  ]);

  if (readingResult.error) {
    throw new Error(`No se pudo leer sensor_readings: ${readingResult.error.message}`);
  }

  if (eventsResult.error) {
    throw new Error(`No se pudo leer device_events: ${eventsResult.error.message}`);
  }

  const reading = readingResult.data;

  return {
    user: {
      id: userResult.data.id,
      name: userResult.data.name,
      contactName: userResult.data.responsible_contact ?? '',
    },
    device: {
      id: deviceResult.data.id,
      name: deviceResult.data.name,
      code: deviceResult.data.device_code,
      battery: toOptionalNumber(deviceResult.data.current_battery),
      desiredDisplayOn: deviceResult.data.desired_display_on ?? true,
      desiredDisplayView: toDisplayView(deviceResult.data.desired_display_view) ?? 'menu',
      reportedDisplayOn: deviceResult.data.reported_display_on ?? null,
      reportedDisplayView: toDisplayView(deviceResult.data.reported_display_view),
      displayCommandAt: deviceResult.data.display_command_at ?? null,
      displayReportedAt: deviceResult.data.display_reported_at ?? null,
    },
    latestReading: reading
      ? {
          heartRate: toOptionalNumber(reading.heart_rate),
          oxygen: toOptionalNumber(reading.spo2),
          battery: toOptionalNumber(reading.battery_level),
          impact: toOptionalNumber(reading.impact_value),
          recordedAt: reading.recorded_at,
        }
      : null,
    events: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      type: event.type,
      severity: event.severity,
      message: event.message,
      eventTime: event.event_time,
    })),
  };
}

function toDisplayView(value: unknown): DeviceDisplayView | null {
  if (
    value === 'menu' ||
    value === 'vitals' ||
    value === 'movement' ||
    value === 'status' ||
    value === 'medication'
  ) {
    return value;
  }

  return null;
}

function toOptionalNumber(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}
