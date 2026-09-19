import type { DeviceAlertState, ReadingStatus, VitalTrend, WatchStatus } from '../constants/vitalwatch';

// BIOSYS 1.0.4 envia cada 5 s. Tres entregas perdidas son margen suficiente
// antes de dejar de presentar el dato como una lectura actual.
export const REMOTE_READING_MAX_AGE_MS = 20_000;
export const REMOTE_COMMUNICATION_MAX_AGE_MS = 75_000;

type RemoteReading = {
  heartRate: number | null;
  oxygen: number | null;
  battery: number | null;
};

// null significa ausencia de medicion, nunca un valor normal de ejemplo.
export function readRemoteMeasurements(reading: RemoteReading | null) {
  const heartRate = reading?.heartRate ?? null;
  const oxygen = reading?.oxygen ?? null;
  const battery = reading?.battery ?? null;
  return {
    heartRate: heartRate !== null && Number.isFinite(heartRate) && heartRate > 0 ? heartRate : null,
    oxygen: oxygen !== null && Number.isFinite(oxygen) && oxygen > 0 && oxygen <= 100 ? oxygen : null,
    battery: battery !== null && Number.isFinite(battery) && battery >= 0 && battery <= 100 ? battery : null,
  };
}

export function getRemoteReadingStatus(
  recordedAt: string | null,
  nowMs = Date.now()
): Extract<ReadingStatus, 'Reciente' | 'Demorada' | 'Sin comunicacion' | 'Sin datos'> {
  if (!recordedAt) return 'Sin datos';
  const recordedAtMs = new Date(recordedAt).getTime();
  if (!Number.isFinite(recordedAtMs)) return 'Sin datos';
  const ageMs = Math.max(0, nowMs - recordedAtMs);
  if (ageMs <= REMOTE_READING_MAX_AGE_MS) return 'Reciente';
  if (ageMs <= REMOTE_COMMUNICATION_MAX_AGE_MS) return 'Demorada';
  return 'Sin comunicacion';
}

export function getTrend(previous: number | null, next: number | null): VitalTrend {
  if (previous === null || next === null) return 'sin datos';
  if (next - previous >= 2) return 'sube';
  if (next - previous <= -2) return 'baja';
  return 'estable';
}

export function getRemoteStatus(
  events: { type: string }[],
  heartRate: number | null,
  oxygen: number | null,
  alertState: DeviceAlertState | null
): WatchStatus {
  // Una lectura ausente no debe ocultar una alerta ya recibida.
  if (alertState === 'sos') return 'SOS';
  if (alertState === 'fall') return 'Caida detectada';
  const latestEvent = events[0]?.type;
  if (
    latestEvent === 'battery_low' ||
    latestEvent === 'heart_rate_abnormal' ||
    latestEvent === 'heart_rate_high' ||
    latestEvent === 'spo2_low'
  ) {
    return 'Alerta';
  }
  if (latestEvent === 'medication_pending') return 'Medicacion pendiente';

  // Se conservan los umbrales experimentales existentes, solo para valores presentes.
  if ((heartRate !== null && heartRate >= 110) || (oxygen !== null && oxygen <= 92)) return 'SOS';
  if ((heartRate !== null && heartRate >= 100) || (oxygen !== null && oxygen <= 94)) return 'Alerta';
  if (heartRate === null || oxygen === null) return 'Sin lectura';
  return 'Normal';
}
