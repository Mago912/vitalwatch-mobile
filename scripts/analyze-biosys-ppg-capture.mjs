import fs from 'node:fs';
import path from 'node:path';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Uso: node scripts/analyze-biosys-ppg-capture.mjs <captura.csv>');
  process.exit(2);
}

const absolutePath = path.resolve(csvPath);
const lines = fs.readFileSync(absolutePath, 'utf8').trim().split(/\r?\n/);
const header = lines[0].split(',');
const rows = lines.slice(1).map((line) =>
  Object.fromEntries(line.split(',').map((value, index) => [header[index], value])),
);

function percentile(values, target) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(((sorted.length - 1) * target) / 100)];
}

function median(values) {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function countBy(values) {
  return values.reduce((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function longestContinuousDuration(sourceRows, predicate) {
  let startedUs = null;
  let previousUs = null;
  let longestUs = 0;

  for (const row of sourceRows) {
    const timestampUs = Number(row.sample_time_us);
    const continuous =
      previousUs === null || timestampUs - previousUs === 40000;

    if (predicate(row) && continuous) {
      if (startedUs === null) startedUs = timestampUs;
    } else {
      if (startedUs !== null && previousUs !== null) {
        longestUs = Math.max(longestUs, previousUs - startedUs + 40000);
      }
      startedUs = predicate(row) ? timestampUs : null;
    }
    previousUs = timestampUs;
  }

  if (startedUs !== null && previousUs !== null) {
    longestUs = Math.max(longestUs, previousUs - startedUs + 40000);
  }
  return longestUs;
}

function countTransitions(sourceRows, fromState, toState) {
  let count = 0;
  for (let index = 1; index < sourceRows.length; index += 1) {
    if (
      Number(sourceRows[index - 1].detector_state) === fromState &&
      Number(sourceRows[index].detector_state) === toState
    ) {
      count += 1;
    }
  }
  return count;
}

class ChannelDetector {
  constructor(nmsRadiusUs, thresholdFraction) {
    this.nmsRadiusUs = nmsRadiusUs;
    this.thresholdFraction = thresholdFraction;
    this.reset();
  }

  reset() {
    this.calibrated = false;
    this.calibrationSamples = 0;
    this.calibration = [];
    this.raw = [];
    this.filtered = 0;
    this.previous1 = 0;
    this.previous2 = 0;
    this.valley = 0;
    this.previousTimestampUs = 0;
    this.noise = 0.5;
    this.signal = 1.5;
    this.fusedProminences = [];
    this.pending = [];
  }

  threshold() {
    return Math.max(
      0.75,
      this.noise + this.thresholdFraction * Math.max(0, this.signal - this.noise),
    );
  }

  signalToNoise() {
    return this.signal / Math.max(0.001, this.noise);
  }

  filteredSample() {
    let longSum = 0;
    let shortSum = 0;
    for (let offset = 0; offset < 20; offset += 1) {
      const value = this.raw[this.raw.length - 1 - offset];
      longSum += value;
      if (offset < 7) shortSum += value;
    }
    return shortSum / 7 - longSum / 20;
  }

  addPendingMaximum(timestampUs, prominence) {
    let suppressed = false;
    for (const pending of this.pending) {
      if (timestampUs - pending.timestampUs > this.nmsRadiusUs) continue;
      if (prominence > pending.prominence) pending.suppressed = true;
      else suppressed = true;
    }
    this.pending.push({ timestampUs, prominence, suppressed });
  }

  emitMaturedMaximum(observedAtUs, observation) {
    if (
      this.pending.length === 0 ||
      observedAtUs - this.pending[0].timestampUs < this.nmsRadiusUs
    ) {
      return;
    }
    const pending = this.pending.shift();
    if (!pending.suppressed) {
      observation.timestampUs = pending.timestampUs;
      observation.prominence = pending.prominence;
      observation.candidate = true;
    }
  }

  update(raw, timestampUs) {
    const observation = {
      timestampUs,
      observedAtUs: timestampUs,
      prominence: 0,
      threshold: this.threshold(),
      snr: this.signalToNoise(),
      calibrated: false,
      candidate: false,
      artifact: false,
    };

    this.emitMaturedMaximum(timestampUs, observation);
    this.raw.push(raw);
    if (this.raw.length > 20) this.raw.shift();
    this.calibrationSamples += 1;

    if (this.raw.length < 20) {
      this.previousTimestampUs = timestampUs;
      return observation;
    }

    this.filtered = this.filteredSample();
    if (this.filtered < this.valley) this.valley = this.filtered;
    const localMaximum =
      this.previous1 > this.previous2 && this.previous1 >= this.filtered;
    const localProminence = localMaximum
      ? Math.max(0, this.previous1 - this.valley)
      : 0;

    if (!this.calibrated) {
      if (localMaximum && localProminence > 0) {
        this.calibration.push(localProminence);
        if (this.calibration.length > 32) this.calibration.shift();
        this.valley = this.filtered;
      }
      if (this.calibrationSamples >= 50 && this.calibration.length >= 4) {
        this.noise = Math.max(0.5, percentile(this.calibration, 25));
        this.signal = Math.max(this.noise + 1, percentile(this.calibration, 90));
        this.calibrated = true;
        this.valley = this.filtered;
      }
      this.finishObservation(observation, timestampUs);
      return observation;
    }

    if (localMaximum) {
      const fusedMedian = this.fusedProminences.length
        ? median(this.fusedProminences)
        : 0;
      observation.artifact =
        this.fusedProminences.length >= 4 &&
        fusedMedian > 0 &&
        localProminence > 6 * fusedMedian;
      const eligible = !observation.artifact && localProminence >= this.threshold();
      if (eligible) this.addPendingMaximum(this.previousTimestampUs, localProminence);
      if (!eligible && !observation.artifact) {
        const bounded = Math.min(localProminence, this.threshold());
        this.noise += 0.1 * (bounded - this.noise);
      }
      this.valley = this.filtered;
    }

    this.finishObservation(observation, timestampUs);
    observation.calibrated = true;
    return observation;
  }

  finishObservation(observation, timestampUs) {
    this.previous2 = this.previous1;
    this.previous1 = this.filtered;
    this.previousTimestampUs = timestampUs;
    observation.threshold = this.threshold();
    observation.snr = this.signalToNoise();
    observation.calibrated = this.calibrated;
  }

  confirmFused(prominence) {
    if (!this.calibrated || !Number.isFinite(prominence) || prominence <= 0) return;
    this.signal += 0.125 * (prominence - this.signal);
    this.fusedProminences.push(prominence);
    if (this.fusedProminences.length > 32) this.fusedProminences.shift();
  }
}

class BeatFusion {
  constructor() {
    this.pendingRed = null;
    this.pendingIr = null;
    this.lastFusedUs = 0;
    this.ibis = [];
    this.synchronized = [];
  }

  recordSynchronization(value) {
    this.synchronized.push(value);
    if (this.synchronized.length > 8) this.synchronized.shift();
  }

  withMetrics(result) {
    result.ibiCount = this.ibis.length;
    result.synchronizedCount = this.synchronized.filter(Boolean).length;
    result.synchronizationWindowSize = this.synchronized.length;
    if (this.ibis.length === 0) {
      result.bpm = Number.NaN;
      result.madRatio = Number.NaN;
      result.rangeMs = 0;
      return result;
    }

    const sorted = [...this.ibis].sort((left, right) => left - right);
    const ibiMedian = sorted[Math.floor(sorted.length / 2)];
    const deviations = sorted
      .map((value) => Math.abs(value - ibiMedian))
      .sort((left, right) => left - right);
    result.bpm = 60000 / ibiMedian;
    result.madRatio = deviations[Math.floor(deviations.length / 2)] / ibiMedian;
    result.rangeMs = sorted.at(-1) - sorted[0];
    return result;
  }

  update(red, ir) {
    const result = { fused: false, ibiMs: 0, redProminence: 0, irProminence: 0 };
    const now = Math.max(red.observedAtUs, ir.observedAtUs);
    if (this.pendingRed && now - this.pendingRed.observedAtUs > 120000) {
      this.pendingRed = null;
      this.recordSynchronization(false);
    }
    if (this.pendingIr && now - this.pendingIr.observedAtUs > 120000) {
      this.pendingIr = null;
      this.recordSynchronization(false);
    }
    if (red.candidate && !red.artifact) this.pendingRed = red;
    if (ir.candidate && !ir.artifact) this.pendingIr = ir;
    if (!this.pendingRed || !this.pendingIr) return this.withMetrics(result);

    const difference = Math.abs(
      this.pendingRed.timestampUs - this.pendingIr.timestampUs,
    );
    if (difference > 120000) {
      if (this.pendingRed.timestampUs < this.pendingIr.timestampUs) this.pendingRed = null;
      else this.pendingIr = null;
      this.recordSynchronization(false);
      return this.withMetrics(result);
    }

    const timestampUs =
      Math.min(this.pendingRed.timestampUs, this.pendingIr.timestampUs) +
      Math.floor(difference / 2);
    result.fused = true;
    result.redProminence = this.pendingRed.prominence;
    result.irProminence = this.pendingIr.prominence;
    this.pendingRed = null;
    this.pendingIr = null;

    if (this.lastFusedUs === 0) {
      this.lastFusedUs = timestampUs;
      this.recordSynchronization(true);
      return this.withMetrics(result);
    }

    const ibiMs = Math.floor((timestampUs - this.lastFusedUs) / 1000);
    if (ibiMs < 330) {
      result.fused = false;
      this.recordSynchronization(false);
      return this.withMetrics(result);
    }

    this.lastFusedUs = timestampUs;
    if (ibiMs > 1600) {
      this.ibis = [];
      this.synchronized = [];
      this.recordSynchronization(true);
      return this.withMetrics(result);
    }

    result.ibiMs = ibiMs;
    this.ibis.push(ibiMs);
    if (this.ibis.length > 8) this.ibis.shift();
    this.recordSynchronization(true);
    return this.withMetrics(result);
  }
}

function lastRecalibrationStart(sourceRows) {
  let start = 0;
  for (let index = 1; index < sourceRows.length; index += 1) {
    if (
      Number(sourceRows[index - 1].detector_state) === 3 &&
      Number(sourceRows[index].detector_state) === 0
    ) {
      start = index + 1;
    }
  }
  return start;
}

function simulate(sourceRows, nmsRadiusUs, thresholdFraction) {
  const redDetector = new ChannelDetector(nmsRadiusUs, thresholdFraction);
  const irDetector = new ChannelDetector(nmsRadiusUs, thresholdFraction);
  const fusion = new BeatFusion();
  const cleanStartedUs = Number(sourceRows[0].sample_time_us);
  let redCandidates = 0;
  let irCandidates = 0;
  let fusedBeats = 0;
  let validSamples = 0;
  let validStartedUs = null;
  let longestValidUs = 0;

  for (const row of sourceRows) {
    const timestampUs = Number(row.sample_time_us);
    const red = redDetector.update(Number(row.red_raw), timestampUs);
    const ir = irDetector.update(Number(row.ir_raw), timestampUs);
    if (red.candidate) redCandidates += 1;
    if (ir.candidate) irCandidates += 1;

    const beat = fusion.update(red, ir);
    if (beat.fused) {
      fusedBeats += 1;
      redDetector.confirmFused(beat.redProminence);
      irDetector.confirmFused(beat.irProminence);
    }

    const technicallyValid =
      beat.ibiCount >= 6 &&
      beat.madRatio <= 0.12 &&
      beat.rangeMs <= 300 &&
      beat.synchronizationWindowSize >= 6 &&
      beat.synchronizedCount >= 6 &&
      red.snr >= 1.5 &&
      ir.snr >= 1.5 &&
      timestampUs - cleanStartedUs >= 5000000;

    if (technicallyValid) {
      validSamples += 1;
      if (validStartedUs === null) validStartedUs = timestampUs;
    } else if (validStartedUs !== null) {
      longestValidUs = Math.max(
        longestValidUs,
        timestampUs - 40000 - validStartedUs + 40000,
      );
      validStartedUs = null;
    }
  }

  if (validStartedUs !== null) {
    longestValidUs = Math.max(
      longestValidUs,
      Number(sourceRows.at(-1).sample_time_us) - validStartedUs + 40000,
    );
  }

  return {
    nmsRadiusMs: nmsRadiusUs / 1000,
    thresholdFraction,
    maximumRepresentableHeartRate: Math.floor(60000000 / nmsRadiusUs),
    redCandidates,
    irCandidates,
    fusedBeats,
    validSamples,
    longestValidMs: longestValidUs / 1000,
  };
}

const startIndex = lastRecalibrationStart(rows);
const cleanRows = rows.slice(startIndex);
const observedTrackingRows = rows.slice(
  rows.findLastIndex((row, index) =>
    index > 0 &&
    Number(rows[index - 1].detector_state) === 0 &&
    Number(row.detector_state) === 1,
  ),
);
const observed = {
  redCandidates: observedTrackingRows.filter((row) => Number(row.red_candidate) === 1)
    .length,
  irCandidates: observedTrackingRows.filter((row) => Number(row.ir_candidate) === 1)
    .length,
  fusedBeats: observedTrackingRows.filter((row) => Number(row.peak_fused) === 1)
    .length,
};

const numericFlags = rows.map((row) => Number(row.ppg_quality_flags));
const validRows = rows.filter((row) => Number(row.hr_status) === 0);
const ibis = rows
  .map((row) => Number(row.ibi_ms))
  .filter((value) => Number.isFinite(value) && value > 0);
const deltas = rows.slice(1).map(
  (row, index) => Number(row.sample_time_us) - Number(rows[index].sample_time_us),
);
const actual = {
  records: rows.length,
  timing: {
    consecutivePairs: deltas.length,
    badDeltaCount: deltas.filter((value) => value !== 40000).length,
    minimumDeltaUs: Math.min(...deltas),
    maximumDeltaUs: Math.max(...deltas),
    suspectedDrops: Math.max(...rows.map((row) => Number(row.suspected_drops))),
    missingSamples: Math.max(...rows.map((row) => Number(row.missing_samples))),
  },
  statusCounts: countBy(rows.map((row) => Number(row.hr_status))),
  signal: {
    redCandidates: rows.filter((row) => Number(row.red_candidate) === 1).length,
    irCandidates: rows.filter((row) => Number(row.ir_candidate) === 1).length,
    fusedBeats: rows.filter((row) => Number(row.peak_fused) === 1).length,
    ibiSamples: ibis.length,
    minimumIbiMs: ibis.length ? Math.min(...ibis) : null,
    medianIbiMs: ibis.length ? median(ibis) : null,
    maximumIbiMs: ibis.length ? Math.max(...ibis) : null,
    ibiInconsistentRows: numericFlags.filter((flags) => flags & 16).length,
    channelMismatchRows: numericFlags.filter((flags) => flags & 512).length,
    opticalTransientRows: numericFlags.filter((flags) => flags & 256).length,
    highMotionRows: numericFlags.filter((flags) => flags & 128).length,
    timingInvalidRows: numericFlags.filter((flags) => flags & 32).length,
    quarantineEntries: countTransitions(rows, 2, 3) + countTransitions(rows, 1, 3),
    recalibrationEntries: countTransitions(rows, 3, 0),
  },
  technicalValidity: {
    validSamples: validRows.length,
    longestValidMs: longestContinuousDuration(
      rows,
      (row) => Number(row.hr_status) === 0,
    ) / 1000,
    validWithHighMotion: validRows.filter(
      (row) => Number(row.ppg_quality_flags) & 128,
    ).length,
    validWithOpticalTransient: validRows.filter(
      (row) => Number(row.ppg_quality_flags) & 256,
    ).length,
    validWithTimingInvalid: validRows.filter(
      (row) => Number(row.ppg_quality_flags) & 32,
    ).length,
    validWithInsufficientDualChannelEvidence: validRows.filter(
      (row) => Number(row.synchronized_count) < 6,
    ).length,
  },
};

const radiiUs = [320000, 360000, 400000, 440000, 480000, 520000, 560000, 600000, 640000];
const thresholdFractions = [0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];
const result = {
  evidenceType: 'CODEX REPRODUCTION TESTS',
  source: path.relative(process.cwd(), absolutePath).replaceAll('\\', '/'),
  analyzedRows: cleanRows.length,
  actual,
  observed,
  radiusSweep: radiiUs.map((radiusUs) => simulate(cleanRows, radiusUs, 0.05)),
  thresholdSweep: thresholdFractions.map((fraction) =>
    simulate(cleanRows, 320000, fraction),
  ),
};

console.log(JSON.stringify(result, null, 2));
