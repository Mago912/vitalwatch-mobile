import fs from 'node:fs';
import path from 'node:path';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Uso: node scripts/explore-biosys-ibi-selector.mjs <captura.csv>');
  process.exit(2);
}

const lines = fs.readFileSync(path.resolve(csvPath), 'utf8').trim().split(/\r?\n/);
const header = lines[0].split(',');
const rows = lines.slice(1).map((line) =>
  Object.fromEntries(line.split(',').map((value, index) => [header[index], value])),
);

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function metrics(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const center = median(sorted);
  const deviations = sorted
    .map((value) => Math.abs(value - center))
    .sort((left, right) => left - right);
  return {
    bpm: 60000 / center,
    madRatio: median(deviations) / center,
    rangeMs: sorted.at(-1) - sorted[0],
  };
}

const strategies = {
  current(values) {
    return metrics(values);
  },
  trimOneAtEachEnd(values) {
    const sorted = [...values].sort((left, right) => left - right);
    return metrics(sorted.length >= 8 ? sorted.slice(1, -1) : sorted);
  },
  sixClosestToMedian(values) {
    const center = median(values);
    const selected = [...values]
      .sort((left, right) =>
        Math.abs(left - center) - Math.abs(right - center) || left - right,
      )
      .slice(0, Math.min(6, values.length));
    return metrics(selected);
  },
};

function simulate(strategy) {
  const ibis = [];
  let validSamples = 0;
  let validStartedUs = null;
  let longestValidUs = 0;
  let validWithUnsafeFlag = 0;
  let validWithInsufficientDualChannelEvidence = 0;
  let previousState = null;

  for (const row of rows) {
    const timestampUs = Number(row.sample_time_us);
    const detectorState = Number(row.detector_state);
    const fused = Number(row.peak_fused) === 1;
    const ibiMs = Number(row.ibi_ms);

    if (
      detectorState === 0 ||
      detectorState === 3 ||
      detectorState === 4 ||
      (previousState === 3 && detectorState === 0)
    ) {
      ibis.length = 0;
    }
    if (fused && ibiMs === 0) ibis.length = 0;
    if (ibiMs > 0) {
      ibis.push(ibiMs);
      if (ibis.length > 8) ibis.shift();
    }

    const calculated = ibis.length >= 6 ? strategy(ibis) : null;
    const flags = Number(row.ppg_quality_flags);
    const unsafeFlags = flags & (32 | 64 | 128 | 256);
    const enoughDualChannelEvidence =
      Number(row.synchronized_count) >= 6;
    const eligible =
      (detectorState === 1 || detectorState === 2) &&
      Number(row.red_snr) >= 1.5 &&
      Number(row.ir_snr) >= 1.5 &&
      enoughDualChannelEvidence &&
      unsafeFlags === 0;
    const valid =
      eligible &&
      calculated !== null &&
      calculated.bpm >= 35 &&
      calculated.bpm <= 190 &&
      calculated.madRatio <= 0.12 &&
      calculated.rangeMs <= 300;

    if (valid) {
      validSamples += 1;
      if (unsafeFlags !== 0) validWithUnsafeFlag += 1;
      if (!enoughDualChannelEvidence) validWithInsufficientDualChannelEvidence += 1;
      if (validStartedUs === null) validStartedUs = timestampUs;
    } else if (validStartedUs !== null) {
      longestValidUs = Math.max(longestValidUs, timestampUs - validStartedUs);
      validStartedUs = null;
    }
    previousState = detectorState;
  }

  if (validStartedUs !== null) {
    longestValidUs = Math.max(
      longestValidUs,
      Number(rows.at(-1).sample_time_us) - validStartedUs + 40000,
    );
  }

  return {
    validSamples,
    longestValidMs: longestValidUs / 1000,
    validWithUnsafeFlag,
    validWithInsufficientDualChannelEvidence,
  };
}

function simulateTemporalOutlierFilter({ lowerRatio, upperRatio }) {
  const ibis = [];
  let lastFusedUs = null;
  let outlierStreak = 0;
  let validSamples = 0;
  let validStartedUs = null;
  let longestValidUs = 0;
  let rejectedIntervals = 0;
  let historyResets = 0;
  let previousState = null;

  for (const row of rows) {
    const timestampUs = Number(row.sample_time_us);
    const detectorState = Number(row.detector_state);
    const fused = Number(row.peak_fused) === 1;

    if (
      detectorState === 0 ||
      detectorState === 3 ||
      detectorState === 4 ||
      (previousState === 3 && detectorState === 0)
    ) {
      ibis.length = 0;
      lastFusedUs = null;
      outlierStreak = 0;
    }

    if (fused) {
      if (lastFusedUs === null) {
        lastFusedUs = timestampUs;
      } else {
        const intervalMs = (timestampUs - lastFusedUs) / 1000;
        if (intervalMs < 330) {
          rejectedIntervals += 1;
        } else if (intervalMs > 1600) {
          ibis.length = 0;
          lastFusedUs = timestampUs;
          outlierStreak = 0;
          historyResets += 1;
        } else {
          const center = ibis.length >= 3 ? median(ibis) : null;
          const intervalFits =
            center === null ||
            (intervalMs >= center * lowerRatio && intervalMs <= center * upperRatio);
          lastFusedUs = timestampUs;
          if (intervalFits) {
            ibis.push(intervalMs);
            if (ibis.length > 8) ibis.shift();
            outlierStreak = 0;
          } else {
            rejectedIntervals += 1;
            outlierStreak += 1;
            if (outlierStreak >= 2) {
              ibis.length = 0;
              historyResets += 1;
            }
          }
        }
      }
    }

    const calculated = ibis.length >= 6 ? metrics(ibis) : null;
    const flags = Number(row.ppg_quality_flags);
    const unsafeFlags = flags & (32 | 64 | 128 | 256);
    const recentFusedPair =
      lastFusedUs !== null && timestampUs - lastFusedUs <= 1600000;
    const eligible =
      (detectorState === 1 || detectorState === 2) &&
      Number(row.red_snr) >= 1.5 &&
      Number(row.ir_snr) >= 1.5 &&
      Number(row.synchronized_count) >= 6 &&
      unsafeFlags === 0 &&
      recentFusedPair &&
      outlierStreak <= 1;
    const valid =
      eligible &&
      calculated !== null &&
      calculated.bpm >= 35 &&
      calculated.bpm <= 190 &&
      calculated.madRatio <= 0.12 &&
      calculated.rangeMs <= 300;

    if (valid) {
      validSamples += 1;
      if (validStartedUs === null) validStartedUs = timestampUs;
    } else if (validStartedUs !== null) {
      longestValidUs = Math.max(longestValidUs, timestampUs - validStartedUs);
      validStartedUs = null;
    }
    previousState = detectorState;
  }

  if (validStartedUs !== null) {
    longestValidUs = Math.max(
      longestValidUs,
      Number(rows.at(-1).sample_time_us) - validStartedUs + 40000,
    );
  }

  return {
    lowerRatio,
    upperRatio,
    validSamples,
    longestValidMs: longestValidUs / 1000,
    rejectedIntervals,
    historyResets,
  };
}

const result = {
  evidenceType: 'CODEX EXPLORATORY SIMULATION',
  source: path.relative(process.cwd(), path.resolve(csvPath)).replaceAll('\\', '/'),
  warning: 'No es evidencia fisica ni validacion clinica.',
  actual: {
    validSamples: rows.filter((row) => Number(row.hr_status) === 0).length,
  },
  simulations: Object.fromEntries(
    Object.entries(strategies).map(([name, strategy]) => [name, simulate(strategy)]),
  ),
  temporalOutlierFilter: [
    [0.65, 1.35],
    [0.6, 1.4],
    [0.55, 1.45],
  ].map(([lowerRatio, upperRatio]) =>
    simulateTemporalOutlierFilter({ lowerRatio, upperRatio }),
  ),
};

console.log(JSON.stringify(result, null, 2));
