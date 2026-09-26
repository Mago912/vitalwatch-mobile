import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  parseCsvLine,
  parseReplayResult,
  rowToReplayLine,
} from './biosys-ppg-replay-lib.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const APPENDED_DIAGNOSTICS = [
  'red_prominence', 'red_threshold', 'red_snr', 'red_candidate',
  'ir_prominence', 'ir_threshold', 'ir_snr', 'ir_candidate',
  'peak_fused', 'detector_state', 'quarantine_remaining_ms',
  'synchronized_count',
];

test('appends the dual-channel diagnostics to research output and capture schema', () => {
  const research = fs.readFileSync(path.join(
    ROOT, 'esp32', 'VitalWatch_BIOSYS_1_0_20', 'BioResearch.cpp',
  ), 'utf8');
  const capture = fs.readFileSync(path.join(ROOT, 'scripts', 'capture-biosys-research.ps1'), 'utf8');
  for (const column of APPENDED_DIAGNOSTICS) {
    assert.match(research, new RegExp(`[,\\"]${column}(?:,|\\")`), column);
    assert.match(capture, new RegExp(`,${column}(?:,|')`), column);
  }
});


test('converts an authoritative research row to the eight-field replay protocol', () => {
  const row = {
    sample_index: '7',
    sample_time_us: '1732757',
    red_raw: '168783',
    ir_raw: '188527',
    timing_valid: '1',
    mpu_window_delta_g: '0.00338',
    mpu_window_gyro_rad_s: '0.00775',
    mpu_saturated: '0',
  };

  assert.equal(
    rowToReplayLine(row),
    '7,1732757,168783,188527,1,0.00338,0.00775,0',
  );
});

test('maps the existing BIOSYS research CSV schema to replay fields', () => {
  const header = parseCsvLine(
    'type,session_id,sample_index,sample_time_us,red_raw,ir_raw,mpu_window_delta_g,mpu_window_gyro_rad_s,mpu_saturated',
  );
  const values = parseCsvLine('PPG,1,7,1732757,168783,188527,0.00338,0.00775,0');
  const row = Object.fromEntries(header.map((name, index) => [name, values[index]]));

  assert.equal(
    rowToReplayLine(row),
    '7,1732757,168783,188527,1,0.00338,0.00775,0',
  );
});

test('parses the firmware replay summary without manufacturing validity', () => {
  const result = parseReplayResult(
    '[REPLAY_RESULT] rows=2 rejected=0 fused=0 valid=0 first_valid_us=0 longest_valid_ms=0 bpm_min=nan bpm_max=nan bpm_median=nan quarantine_count=0 recalibration_count=0 unsafe_valid=0 single_channel_valid=0 valid_during_quarantine=0',
  );

  assert.equal(result.rows, 2);
  assert.equal(result.rejected, 0);
  assert.equal(result.fused, 0);
  assert.equal(result.valid, 0);
  assert.equal(result.firstValidUs, 0);
  assert.equal(result.longestValidMs, 0);
  assert.ok(Number.isNaN(result.bpmMin));
  assert.ok(Number.isNaN(result.bpmMax));
  assert.ok(Number.isNaN(result.bpmMedian));
  assert.equal(result.quarantineCount, 0);
  assert.equal(result.recalibrationCount, 0);
  assert.equal(result.unsafeValid, 0);
});

test('rejects malformed replay summaries', () => {
  assert.throws(() => parseReplayResult('[REPLAY_RESULT] rows=2 valid=0'));
});

test('physical CODEX reproduction datasets meet the approved safety barriers', () => {
  const evidence = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'measurements', 'biosys-1.0.20', 'replay-results.json',
  ), 'utf8'));
  const { noFinger, stableTimeline, led35Stable, contactChange } = evidence.datasets;

  assert.equal(evidence.evidenceType, 'CODEX REPRODUCTION TESTS');
  assert.equal(evidence.conclusion, 'INDEPENDENTLY REPRODUCED');
  assert.equal(noFinger.result.valid, 0);
  assert.equal(noFinger.result.fused, 0);
  // 1.0.20 agrega cinco confirmaciones temporales. La captura histórica
  // conserva casi 10 s válidos aun después de ese retardo intencional.
  assert.ok(stableTimeline.result.longestValidMs >= 9_000);
  assert.ok(stableTimeline.result.bpmMedian >= 75);
  assert.ok(stableTimeline.result.bpmMedian <= 95);
  assert.equal(stableTimeline.result.unsafeValid, 0);
  assert.equal(led35Stable.result.singleChannelValid, 0);
  assert.equal(contactChange.result.validDuringQuarantine, 0);
  assert.ok(contactChange.result.recalibrationCount >= 1);
});
