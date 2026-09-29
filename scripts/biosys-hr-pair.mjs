import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// HRPAIR schema 1. Units are explicit; timestamps are sensor-estimated unless now_us.
export const FIELDS = 'type,schema,now_us,session_id,sample_index,contact,instant_status,instant_bpm,instant_flags,instant_us,display_status,display_bpm,display_flags,display_us,ibi_count,ibi_range_ms,ibi_mad_ratio,sync_count,sync_window,red_snr,ir_snr,timing_invalid_total,missing_samples,sw_drops,hw_ovf,service_gap_us,service_gap_max_us,imu_valid'.split(',');
const FLOATS = new Set(['instant_bpm', 'display_bpm', 'ibi_mad_ratio', 'red_snr', 'ir_snr']);
const NAN_ALLOWED = new Set(['instant_bpm', 'display_bpm', 'ibi_mad_ratio']);

export function parsePairLine(line) {
  const match = line.trim().match(/^(\d+)\|(HRPAIR,.*)$/);
  if (!match) throw new Error('Expected host_elapsed_ms|HRPAIR record');
  const values = match[2].split(',');
  if (values.length !== FIELDS.length || values[1] !== '1') throw new Error('Unknown schema or incomplete/mixed record');
  const row = { host_elapsed_ms: Number(match[1]), type: values[0] };
  if (!Number.isSafeInteger(row.host_elapsed_ms)) throw new Error('Invalid host timestamp');
  for (let i = 1; i < FIELDS.length; i++) {
    const name = FIELDS[i], value = values[i];
    if (NAN_ALLOWED.has(name) && value.toLowerCase() === 'nan') { row[name] = NaN; continue; }
    const syntax = FLOATS.has(name) ? /^\d+(?:\.\d+)?$/ : /^\d+$/;
    if (!syntax.test(value)) throw new Error(`Invalid ${name}`);
    row[name] = Number(value);
    if (!Number.isFinite(row[name]) || (!FLOATS.has(name) && !Number.isSafeInteger(row[name]))) throw new Error(`Invalid ${name}`);
  }
  for (const name of ['contact', 'missing_samples', 'imu_valid']) if (row[name] > 1) throw new Error(`Invalid ${name}`);
  for (const name of ['instant_status', 'display_status']) if (row[name] > 6) throw new Error(`Invalid ${name}`);
  for (const prefix of ['instant', 'display']) {
    if (row[`${prefix}_status`] === 0 && !(row[`${prefix}_bpm`] > 0)) throw new Error('VALID without finite BPM');
  }
  return row;
}

const valid = (r, prefix) => r[`${prefix}_status`] === 0 && Number.isFinite(r[`${prefix}_bpm`]);
export function summarizePairs(rows) {
  if (!rows.length) throw new Error('No complete HRPAIR records');
  const result = {
    evidenceType: 'CODEX REPRODUCTION TESTS', records: rows.length,
    instantValid: 0, displayValid: 0, displayValidWhileInstantInvalid: 0,
    instantValidWhileDisplayInvalid: 0, statusMismatch: 0, imuAvailableRows: 0,
    maxDisplaySourceLagMs: 0, futureSourceTimestamps: 0, pollGaps: 0, clockResets: 0,
    sessionChanges: 0, sampleIndexRollbacks: 0,
    longestInstantValidObservedSpanMs: 0, longestDisplayValidObservedSpanMs: 0,
    instantReasons: {}, displayReasons: {}, overflowRows: 0, missingSampleRows: 0,
    maxServiceGapUs: 0,
    note: 'Snapshots at ~1 Hz; observed spans do not prove continuous validity between polls. Zero motion flags with absent IMU do not prove immobility.',
  };
  const started = { instant: null, display: null };
  let previous;
  for (const row of rows) {
    const gap = previous && row.host_elapsed_ms - previous.host_elapsed_ms > 1500;
    const reset = previous && row.now_us <= previous.now_us;
    const sessionChange = previous && row.session_id !== previous.session_id;
    const sampleRollback = previous && row.sample_index < previous.sample_index;
    // Buffered serial responses can be drained in the same host millisecond.
    // Keep the true receipt time; only a backwards host timestamp is unordered.
    if (previous && row.host_elapsed_ms < previous.host_elapsed_ms) throw new Error('Unordered host timestamps');
    if (gap) result.pollGaps++;
    if (reset) result.clockResets++;
    if (sessionChange) result.sessionChanges++;
    if (sampleRollback) result.sampleIndexRollbacks++;
    const a = valid(row, 'instant'), b = valid(row, 'display');
    result.instantValid += +a; result.displayValid += +b;
    result.displayValidWhileInstantInvalid += +(b && !a);
    result.instantValidWhileDisplayInvalid += +(a && !b);
    result.statusMismatch += +(row.instant_status !== row.display_status);
    result.imuAvailableRows += row.imu_valid;
    result.overflowRows += +(row.hw_ovf > 0);
    result.missingSampleRows += row.missing_samples;
    result.maxServiceGapUs = Math.max(result.maxServiceGapUs, row.service_gap_max_us);
    if (row.display_us && row.instant_us >= row.display_us) result.maxDisplaySourceLagMs = Math.max(result.maxDisplaySourceLagMs, (row.instant_us - row.display_us) / 1000);
    result.futureSourceTimestamps += +(row.instant_us > row.now_us || row.display_us > row.now_us);
    for (const prefix of ['instant', 'display']) {
      const reasons = result[`${prefix}Reasons`], flag = `0x${row[`${prefix}_flags`].toString(16)}`;
      reasons[flag] = (reasons[flag] ?? 0) + 1;
      if (gap || reset || sessionChange || sampleRollback || !valid(row, prefix)) started[prefix] = null;
      if (valid(row, prefix)) {
        started[prefix] ??= row.host_elapsed_ms;
        const field = prefix === 'instant' ? 'longestInstantValidObservedSpanMs' : 'longestDisplayValidObservedSpanMs';
        result[field] = Math.max(result[field], row.host_elapsed_ms - started[prefix]);
      }
    }
    previous = row;
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const file = process.argv[2];
    if (!file) throw new Error('Usage: node scripts/biosys-hr-pair.mjs <capture.log>');
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
    const rows = [], rejected = [];
    for (let i = 0; i < lines.length; i++) {
      try { rows.push(parsePairLine(lines[i])); }
      catch (error) { rejected.push({ line: i + 1, reason: error.message }); }
    }
    console.log(JSON.stringify({ source: path.resolve(file), ...summarizePairs(rows), rejected }, null, 2));
    if (rejected.length) process.exitCode = 2;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
