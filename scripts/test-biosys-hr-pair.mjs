import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePairLine, summarizePairs } from './biosys-hr-pair.mjs';

// Hand-written fixture: internal UNSTABLE, display still VALID from 4 s ago.
const held = '1000|HRPAIR,1,10000000,2,250,1,2,78.95,16,9960000,0,75.00,0,6000000,8,320,0.0263,8,8,33.370,273.151,0,0,0,0,2500,80000,0';
const ready = '2000|HRPAIR,1,11000000,2,275,1,0,75.00,0,10960000,0,75.00,0,10960000,8,120,0.0500,8,8,33.370,273.151,0,0,0,0,2500,80000,0';

test('keeps internal and display validity separate, including a held visible value', () => {
  const row = parsePairLine(held);
  assert.equal(row.instant_status, 2);
  assert.equal(row.display_status, 0);
  const report = summarizePairs([row, parsePairLine(ready)]);
  assert.equal(report.instantValid, 1);
  assert.equal(report.displayValid, 2);
  assert.equal(report.displayValidWhileInstantInvalid, 1);
  assert.equal(report.maxDisplaySourceLagMs, 3960);
  assert.equal(report.imuAvailableRows, 0);
});

test('preserves nan and never treats an unstable numeric BPM as valid', () => {
  const line = held.replace(',2,78.95,16,', ',2,nan,2048,').replace(',0,75.00,0,6000000,', ',2,75.00,16,6000000,');
  const row = parsePairLine(line);
  assert.ok(Number.isNaN(row.instant_bpm));
  assert.equal(summarizePairs([row]).instantValid, 0);
  assert.equal(summarizePairs([row]).displayValid, 0);
});

test('rejects partial, mixed, unknown schema and invalid numeric records', () => {
  for (const line of [held.slice(0, -2), held + ',extra', held.replace('HRPAIR,1,', 'HRPAIR,2,'), held.replace('78.95', ''), held.replace('78.95', 'Infinity'), held.replace('HRPAIR,', 'HRPAIR,HRPAIR,'), held.replace(',2,78.95', ',9,78.95'), ready.replace(',0,75.00,0,10960000', ',0,nan,0,10960000')]) {
    assert.throws(() => parsePairLine(line));
  }
});

test('does not join valid runs across missed polls or a device restart', () => {
  const a = parsePairLine(ready);
  const b = parsePairLine(ready.replace('2000|', '3000|').replace('11000000,2,275', '12000000,2,300'));
  const c = parsePairLine(ready.replace('2000|', '6000|').replace('11000000,2,275', '15000000,2,375'));
  const d = parsePairLine(ready.replace('2000|', '7000|').replace('11000000,2,275', '1000000,0,1'));
  const report = summarizePairs([a, b, c, d]);
  assert.equal(report.longestInstantValidObservedSpanMs, 1000);
  assert.equal(report.pollGaps, 1);
  assert.equal(report.clockResets, 1);
});

test('empty captures fail instead of reporting success', () => {
  assert.throws(() => summarizePairs([]));
});

test('accepts coalesced serial responses without fabricating elapsed time, but rejects rollback', () => {
  const a = parsePairLine(ready);
  const b = parsePairLine(ready.replace('11000000,2,275', '12000000,2,300'));
  const report = summarizePairs([a, b]);
  assert.equal(report.records, 2);
  assert.equal(report.instantValid, 2);
  assert.equal(report.longestInstantValidObservedSpanMs, 0);
  assert.equal(report.clockResets, 0);
  assert.throws(() => summarizePairs([a, { ...b, host_elapsed_ms: 1999 }]), /Unordered/);
});

test('distinguishes contact sessions from a clock restart and breaks observed runs', () => {
  const a = parsePairLine(ready);
  const b = parsePairLine(ready.replace('2000|', '3000|').replace('11000000,2,275', '12000000,3,300'));
  const report = summarizePairs([a, b]);
  assert.equal(report.clockResets, 0);
  assert.equal(report.sessionChanges, 1);
  assert.equal(report.longestInstantValidObservedSpanMs, 0);
});
