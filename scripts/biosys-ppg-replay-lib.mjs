const RESULT_PATTERN = /^\[REPLAY_RESULT\]\s+rows=(\d+)\s+rejected=(\d+)\s+fused=(\d+)\s+valid=(\d+)\s+first_valid_us=(\d+)\s+longest_valid_ms=(\d+)\s+bpm_min=(nan|[-+]?\d+(?:\.\d+)?)\s+bpm_max=(nan|[-+]?\d+(?:\.\d+)?)$/i;

export function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error('Unterminated quoted CSV value.');
  values.push(value);
  return values;
}

function required(row, name) {
  const value = row[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing replay field: ${name}`);
  }
  return value;
}

export function rowToReplayLine(row) {
  const timingValid = row.timing_valid ?? (
    row.missing_samples === undefined
      ? '1'
      : (Number(row.missing_samples) === 0 ? '1' : '0')
  );

  return [
    required(row, 'sample_index'),
    required(row, 'sample_time_us'),
    required(row, 'red_raw'),
    required(row, 'ir_raw'),
    timingValid,
    required(row, 'mpu_window_delta_g'),
    required(row, 'mpu_window_gyro_rad_s'),
    required(row, 'mpu_saturated'),
  ].join(',');
}

function numeric(value) {
  return value.toLowerCase() === 'nan' ? Number.NaN : Number(value);
}

export function parseReplayResult(line) {
  const match = RESULT_PATTERN.exec(line.trim());
  if (!match) throw new Error(`Malformed replay result: ${line}`);

  return {
    rows: Number(match[1]),
    rejected: Number(match[2]),
    fused: Number(match[3]),
    valid: Number(match[4]),
    firstValidUs: Number(match[5]),
    longestValidMs: Number(match[6]),
    bpmMin: numeric(match[7]),
    bpmMax: numeric(match[8]),
  };
}
