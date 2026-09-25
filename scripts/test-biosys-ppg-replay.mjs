import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCsvLine,
  parseReplayResult,
  rowToReplayLine,
} from './biosys-ppg-replay-lib.mjs';


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
    '[REPLAY_RESULT] rows=2 rejected=0 fused=0 valid=0 first_valid_us=0 longest_valid_ms=0 bpm_min=nan bpm_max=nan',
  );

  assert.equal(result.rows, 2);
  assert.equal(result.rejected, 0);
  assert.equal(result.fused, 0);
  assert.equal(result.valid, 0);
  assert.equal(result.firstValidUs, 0);
  assert.equal(result.longestValidMs, 0);
  assert.ok(Number.isNaN(result.bpmMin));
  assert.ok(Number.isNaN(result.bpmMax));
});

test('rejects malformed replay summaries', () => {
  assert.throws(() => parseReplayResult('[REPLAY_RESULT] rows=2 valid=0'));
});
