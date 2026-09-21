import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getMedicationOccurrences,
  medicationDaysLabel,
  normalizeMedicationDays,
} from '../lib/medication-schedule.ts';

test('normaliza dias repetidos y fuera de rango', () => {
  assert.deepEqual(normalizeMedicationDays([7, 1, 1, 0, 8, 3]), [1, 3, 7]);
  assert.deepEqual(normalizeMedicationDays([]), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(medicationDaysLabel([1, 3, 5]), 'Lun, Mie, Vie');
});

test('una fecha de inicio pasada calcula la toma de hoy', () => {
  const now = new Date('2026-09-21T14:00:00.000Z'); // 11:00 en Argentina.
  const [occurrence] = getMedicationOccurrences(
    '2026-09-01',
    '10:00',
    [1, 2, 3, 4, 5, 6, 7],
    now,
    1
  );

  assert.equal(occurrence.date, '2026-09-21');
  assert.equal(occurrence.iso, '2026-09-21T13:00:00.000Z');
});

test('una fecha de inicio futura no genera tomas anteriores', () => {
  const now = new Date('2026-09-21T14:00:00.000Z');
  const [occurrence] = getMedicationOccurrences(
    '2026-09-23',
    '10:00',
    [1, 2, 3, 4, 5, 6, 7],
    now,
    1
  );

  assert.equal(occurrence.date, '2026-09-23');
});

test('respeta los dias semanales seleccionados', () => {
  const now = new Date('2026-09-20T12:00:00.000Z'); // Domingo 09:00 en Argentina.
  const occurrences = getMedicationOccurrences('2026-09-01', '10:00', [1, 3], now, 3);

  assert.deepEqual(
    occurrences.map((occurrence) => occurrence.date),
    ['2026-09-21', '2026-09-23', '2026-09-28']
  );
});

test('mantiene la toma actual durante seis horas y luego avanza', () => {
  const withinWindow = getMedicationOccurrences(
    '2026-09-01',
    '10:00',
    [1, 2, 3, 4, 5, 6, 7],
    new Date('2026-09-21T18:59:00.000Z'),
    1
  )[0];
  const afterWindow = getMedicationOccurrences(
    '2026-09-01',
    '10:00',
    [1, 2, 3, 4, 5, 6, 7],
    new Date('2026-09-21T19:01:00.000Z'),
    1
  )[0];

  assert.equal(withinWindow.date, '2026-09-21');
  assert.equal(afterWindow.date, '2026-09-22');
});
