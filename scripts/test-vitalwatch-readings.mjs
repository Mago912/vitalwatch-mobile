import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getRemoteReadingStatus,
  getRemoteStatus,
  getTrend,
  isRecentValidMeasurement,
  readRemoteMeasurements,
  REMOTE_COMMUNICATION_MAX_AGE_MS,
  REMOTE_READING_MAX_AGE_MS,
} from '../lib/vitalwatch-readings.ts';

test('sin telemetria no se inventan signos ni bateria', () => {
  assert.deepEqual(readRemoteMeasurements(null), { heartRate: null, oxygen: null, battery: null });
  assert.deepEqual(readRemoteMeasurements({ heartRate: null, oxygen: null, battery: null }), {
    heartRate: null, oxygen: null, battery: null,
  });
});

test('lecturas parciales conservan solo los valores recibidos, incluso bateria cero', () => {
  assert.deepEqual(readRemoteMeasurements({ heartRate: null, oxygen: 97, battery: 0 }), {
    heartRate: null, oxygen: 97, battery: 0,
  });
  assert.deepEqual(readRemoteMeasurements({ heartRate: 81, oxygen: 96, battery: 53 }), {
    heartRate: 81, oxygen: 96, battery: 53,
  });
});

test('valores no finitos o imposibles no se muestran como mediciones', () => {
  for (const reading of [
    { heartRate: NaN, oxygen: Infinity, battery: NaN },
    { heartRate: 0, oxygen: 0, battery: -1 },
    { heartRate: -8, oxygen: 101, battery: 101 },
  ]) assert.deepEqual(readRemoteMeasurements(reading), { heartRate: null, oxygen: null, battery: null });
});

test('sin lecturas no hay Normal ni SOS por comparar null con un umbral', () => {
  assert.equal(getRemoteStatus([], null, null, 'none'), 'Sin lectura');
  assert.equal(getRemoteStatus([], 76, null, 'none'), 'Sin lectura');
  assert.equal(getRemoteStatus([], null, 98, 'none'), 'Sin lectura');
  assert.equal(getRemoteStatus([], 76, 98, 'none'), 'Normal');
});

test('las alertas reales tienen prioridad sobre la falta de lecturas', () => {
  assert.equal(getRemoteStatus([], null, null, 'fall'), 'Caida detectada');
  assert.equal(getRemoteStatus([], null, null, 'sos'), 'SOS');
  assert.equal(getRemoteStatus([{ type: 'battery_low' }], null, null, 'none'), 'Alerta');
  assert.equal(getRemoteStatus([{ type: 'medication_pending' }], null, null, 'none'), 'Medicacion pendiente');
  assert.equal(getRemoteStatus([{ type: 'medication_missed' }], null, null, 'none'), 'Medicacion pendiente');
  assert.equal(getRemoteStatus([], null, 91, 'none'), 'SOS');
  assert.equal(getRemoteStatus([], 101, null, 'none'), 'Alerta');
});

test('la tendencia no usa una lectura ausente como si fuera cero', () => {
  assert.equal(getTrend(null, 76), 'sin datos');
  assert.equal(getTrend(76, null), 'sin datos');
  assert.equal(getTrend(76, 79), 'sube');
  assert.equal(getTrend(79, 76), 'baja');
  assert.equal(getTrend(76, 77), 'estable');
});

test('la antiguedad distingue lectura actual, demorada y pulsera sin comunicacion', () => {
  const now = Date.parse('2026-09-13T12:00:00.000Z');
  assert.equal(getRemoteReadingStatus(null, now), 'Sin datos');
  assert.equal(getRemoteReadingStatus('fecha-invalida', now), 'Sin datos');
  assert.equal(getRemoteReadingStatus(new Date(now - 10_000).toISOString(), now), 'Reciente');
  assert.equal(
    getRemoteReadingStatus(new Date(now - REMOTE_READING_MAX_AGE_MS).toISOString(), now),
    'Reciente'
  );
  assert.equal(
    getRemoteReadingStatus(new Date(now - REMOTE_READING_MAX_AGE_MS - 1).toISOString(), now),
    'Demorada'
  );
  assert.equal(
    getRemoteReadingStatus(new Date(now - REMOTE_COMMUNICATION_MAX_AGE_MS).toISOString(), now),
    'Demorada'
  );
  assert.equal(
    getRemoteReadingStatus(new Date(now - REMOTE_COMMUNICATION_MAX_AGE_MS - 1).toISOString(), now),
    'Sin comunicacion'
  );
});

test('una medicion valida reciente sobrevive a filas posteriores sin ese signo', () => {
  const now = Date.parse('2026-09-22T03:00:00.000Z');
  assert.equal(isRecentValidMeasurement('2026-09-22T02:59:10.000Z', now), true);
  assert.equal(isRecentValidMeasurement('2026-09-22T02:58:40.000Z', now), false);
  assert.equal(isRecentValidMeasurement(null, now), false);
});
