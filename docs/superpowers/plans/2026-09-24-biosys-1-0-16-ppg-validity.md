# BIOSYS 1.0.16 PPG Validity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and physically validate BIOSYS 1.0.16 so a stationary, internally coherent MAX30102 signal can reach `HeartRateStatus::VALID` without accepting contact changes, motion, timing faults, or single-channel artifacts.

**Architecture:** Copy BIOSYS 1.0.15 into a separately versioned 1.0.16 candidate. Move peak detection into fixed-memory red and IR channel detectors, fuse only temporally matched candidates, and put an explicit validity/quarantine state machine between fused beats and public HR results. Exercise the exact ESP32 pipeline through a Serial replay mode before any normal firmware is installed.

**Tech Stack:** Arduino C++ for ESP32, SparkFun MAX3010x, PowerShell serial tooling, Python `unittest`, Node.js tests, Arduino CLI.

**Spec:** `docs/superpowers/specs/2026-09-24-biosys-1-0-16-ppg-validity-design.md`

## Global Constraints

- Product identity is BIOSYS `1.0.16`, SYS remains `0.9.9`, BIO becomes `0.7.0`, and HR algorithm becomes `0x0700`.
- Research experiment id is `PPG-DUAL-CHANNEL-A`; research LED remains fixed at `0x35`.
- `PpgSampleTimeline` and its exact 40000 us cadence are unchanged.
- `Sensor_Movimiento.cpp` and `Sensor_Movimiento.h` remain byte-identical to BIOSYS 1.0.15.
- Motion data are read-only quality hints; fall detection and alert behavior are out of scope.
- No dynamic allocation, recursion, FFT result path, or new app/API contract.
- `VALID` means internal technical validity, not clinical accuracy.
- Flash growth is at most 12288 bytes and global RAM growth is at most 2048 bytes over the BIOSYS 1.0.15 research baseline.
- New tests are labeled `CODEX REPRODUCTION TESTS`, never Cowork tests.
- Every production behavior follows a test-first RED/GREEN cycle.

## File Structure

- Create `esp32/VitalWatch_BIOSYS_1_0_16/` as the isolated candidate copied from 1.0.15.
- Create `PpgChannelDetector.h/.cpp` for one-channel filtering, adaptive prominence, and candidates.
- Create `PpgBeatFusion.h/.cpp` for red/IR matching, refractory handling, and IBI history.
- Create `PpgValidityGate.h/.cpp` for calibration, quarantine, motion/optical rejection, and validity.
- Create `BioReplay.h/.cpp` for the Serial replay protocol and authoritative summaries.
- Modify `Sensor_Oxigeno.h/.cpp` only as the acquisition/result integration layer.
- Modify the 1.0.16 `.ino` only to select replay input and provide `PpgMotionHint`.
- Modify `BioResearch.h/.cpp` to append diagnostics without changing legacy column meanings.
- Create `scripts/replay-biosys-ppg.ps1` for CSV-to-Serial replay and assertions.
- Create `scripts/test-biosys-ppg-replay.mjs` for dataset parsing and result parsing.
- Create `esp32/tests/test_biosys_1_0_16_ppg.py` for version, immutability, and source contracts.
- Create `esp32/tests/ppg_dual_channel_test/ppg_dual_channel_test.ino` as a compile contract.
- Modify `scripts/esp32-firmware.ps1`, `scripts/capture-biosys-research.ps1`, and `package.json`.
- Create `CAMBIOS_1_0_16.md` and `RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md`.

## Review Focus

- A replay beginning with high DC or midway through a session must recalibrate and cannot inherit validity; Tasks 2 and 6 test reset/start behavior.
- A waveform in only red or only IR must never become valid; Task 4 tests both directions.
- One severe motion sample and three consecutive moderate samples quarantine, while one isolated moderate sample does not; Task 5 tests all three.
- A sequence gap, reversed timestamp, or `timing_valid=0` clears IBI and invalidates output; Task 6 tests each fault.
- Timestamps near 32-bit rollover must not create a short false IBI; Task 4 tests `uint64_t` timestamps across that boundary.

---

### Task 1: Create the isolated 1.0.16 candidate and immutable guards

**Files:**
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/**`
- Create: `esp32/tests/test_biosys_1_0_16_ppg.py`
- Modify: `scripts/esp32-firmware.ps1`

**Interfaces:**
- Consumes: BIOSYS 1.0.15 as the exact baseline.
- Produces: a separately buildable 1.0.16 directory and guard suite.

- [ ] **Step 1: Write the failing identity and immutability tests**

```python
ROOT = pathlib.Path(__file__).resolve().parents[2]
BASELINE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_15"
CANDIDATE = ROOT / "esp32" / "VitalWatch_BIOSYS_1_0_16"

class TestBiosys1016PpgValidity(unittest.TestCase):
    def test_candidate_identity(self):
        config = read(CANDIDATE / "Configuracion.h")
        self.assertIn('VERSION_PRODUCTO = "1.0.16"', config)
        self.assertIn('VERSION_SISTEMA = "0.9.9"', config)
        self.assertIn('VERSION_BIOMEDICA = "0.7.0"', config)
        self.assertIn('BIO_EXPERIMENT_ID = "PPG-DUAL-CHANNEL-A"', config)
        self.assertIn('ALGORITHM_VERSION_HR = 0x0700', config)

    def test_immutable_sensor_files(self):
        for name in ("Sensor_Movimiento.cpp", "Sensor_Movimiento.h",
                     "PpgSampleTimeline.h"):
            self.assertEqual(sha256(BASELINE / name), sha256(CANDIDATE / name), name)
```

- [ ] **Step 2: Run the test and verify RED**

```powershell
& 'C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' esp32/tests/test_biosys_1_0_16_ppg.py -v
```

Expected: FAIL because `VitalWatch_BIOSYS_1_0_16` does not exist.

- [ ] **Step 3: Copy the baseline and change identity only**

Copy the complete directory mechanically, rename its `.ino` to
`VitalWatch_BIOSYS_1_0_16.ino`, and set:

```cpp
static constexpr const char* VERSION_PRODUCTO = "1.0.16";
static constexpr const char* VERSION_SISTEMA = "0.9.9";
static constexpr const char* VERSION_BIOMEDICA = "0.7.0";
static constexpr const char* BIO_EXPERIMENT_ID = "PPG-DUAL-CHANNEL-A";
static constexpr uint16_t ALGORITHM_VERSION_HR = 0x0700;
```

Point `$biosysDirectory`, `$biosysBuildDirectory`, and
`$biosysResearchBuildDirectory` at 1.0.16 while retaining 1.0.15.

- [ ] **Step 4: Run guards and a research build**

```powershell
& 'C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' esp32/tests/test_biosys_1_0_16_ppg.py -v
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-research-build
```

Expected: tests PASS and Arduino compile exits 0.

- [ ] **Step 5: Commit the candidate shell**

```powershell
git add esp32/VitalWatch_BIOSYS_1_0_16 esp32/tests/test_biosys_1_0_16_ppg.py scripts/esp32-firmware.ps1
git -c user.name=Codex -c user.email=codex@local commit -m "chore: start BIOSYS 1.0.16 PPG candidate"
```

### Task 2: Restore authoritative Serial replay and reproduce the failure

**Files:**
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.h`
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp`
- Create: `scripts/replay-biosys-ppg.ps1`
- Create: `scripts/test-biosys-ppg-replay.mjs`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/VitalWatch_BIOSYS_1_0_16.ino`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/Sensor_Oxigeno.h`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/Sensor_Oxigeno.cpp`
- Modify: `scripts/esp32-firmware.ps1`
- Modify: `package.json`
- Test: `esp32/tests/test_biosys_1_0_16_ppg.py`

**Interfaces:**
- Consumes: `PPGService::resetReplay()` and `processReplaySample(const PPGSample&)`.
- Produces: replay build/upload actions and a parseable `[REPLAY_RESULT]` line.

- [ ] **Step 1: Add failing replay contract tests**

```python
def test_replay_protocol_is_wired_to_real_pipeline(self):
    replay = read(CANDIDATE / "BioReplay.cpp")
    sketch = read(CANDIDATE / "VitalWatch_BIOSYS_1_0_16.ino")
    self.assertIn("PPGService::processReplaySample(sample)", replay)
    self.assertIn('strcmp(line,"RESET")', replay)
    self.assertIn('strcmp(line,"END")', replay)
    self.assertIn("BioReplay::update();", sketch)

def test_tooling_has_separate_replay_build(self):
    script = read(ROOT / "scripts" / "esp32-firmware.ps1")
    self.assertIn("biosys-replay-build", script)
    self.assertIn("biosys-1.0.16-replay", script)
    self.assertIn("-DBIO_REPLAY_MODE=1", script)
```

Node parser tests assert:

```js
assert.equal(rowToReplayLine(row),
  "7,1732757,168783,188527,1,0.00338,0.00775,0");
const result = parseReplayResult(
  "[REPLAY_RESULT] rows=2 rejected=0 fused=0 valid=0 first_valid_us=0 longest_valid_ms=0 bpm_min=nan bpm_max=nan"
);
assert.equal(result.valid, 0);
assert.equal(result.longestValidMs, 0);
```

- [ ] **Step 2: Run and verify RED**

```powershell
& 'C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' esp32/tests/test_biosys_1_0_16_ppg.py -v
node --test scripts/test-biosys-ppg-replay.mjs
```

Expected: FAIL because replay files and helpers are absent.

- [ ] **Step 3: Implement protocol without changing HR behavior**

```cpp
struct PpgMotionHint {
  float accelerationDeltaG;
  float gyroMagnitudeRadS;
  bool saturated;
  bool valid;
};

namespace PPGService {
  void setMotionHint(const PpgMotionHint &hint);
  void resetReplay();
  void processReplaySample(const PPGSample &sample);
}
```

Parse eight fields: sequence, time, red, IR, timing-valid, MPU delta-g, gyro,
and saturation. Call `setMotionHint()` before `processReplaySample()`. `END`
emits rows, rejects, fused beats, valid samples, first-valid timestamp, longest
valid span, and valid BPM range. Invalid rows never enter the pipeline.

In replay mode, `BioReplay::update()` is the only Serial consumer. In normal
and research modes, the `.ino` reads `MotionService::latest()`, fills
`PpgMotionHint`, then calls `PPGService::update()`.

Add actions with output `.arduino/build/biosys-1.0.16-replay` and defines
`-DBIO_REPLAY_MODE=1 -DBIO_RESEARCH_MODE=0`.

- [ ] **Step 4: Make parser, contracts, and replay build GREEN**

```powershell
node --test scripts/test-biosys-ppg-replay.mjs
& 'C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' esp32/tests/test_biosys_1_0_16_ppg.py -v
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-replay-build
```

Expected: all commands exit 0.

- [ ] **Step 5: Upload replay and record the baseline reproduction**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-replay-upload -Port COM3
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/replay-biosys-ppg.ps1 -Port COM3 -InputCsv measurements/biosys-1.0.15/20260924-194014-dedo-quieto-timeline-a-toma-1.csv -ExpectValid:$false -OutputPath measurements/biosys-1.0.16/replay-red-timeline-a.log
```

Expected: `valid=0`. The command succeeds because this step asserts reproduction
of the old failure. Record `INDEPENDENTLY REPRODUCED`.

- [ ] **Step 6: Commit replay infrastructure and RED evidence**

```powershell
git add esp32/VitalWatch_BIOSYS_1_0_16 scripts/replay-biosys-ppg.ps1 scripts/test-biosys-ppg-replay.mjs scripts/esp32-firmware.ps1 package.json measurements/biosys-1.0.16/replay-red-timeline-a.log
git -c user.name=Codex -c user.email=codex@local commit -m "test: reproduce PPG validity failure through firmware replay"
```

### Task 3: Implement one-channel adaptive detection

**Files:**
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/PpgChannelDetector.h`
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/PpgChannelDetector.cpp`
- Create: `esp32/tests/ppg_dual_channel_test/ppg_dual_channel_test.ino`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp`
- Modify: `esp32/tests/test_biosys_1_0_16_ppg.py`

**Interfaces:**
- Consumes: raw `uint32_t` samples and `uint64_t` timestamps.
- Produces: `PpgChannelDetector::update()` returning `PpgChannelObservation`.

- [ ] **Step 1: Write failing weak-pulse and outlier tests**

Define the expected public compile contract:

```cpp
#include "../../VitalWatch_BIOSYS_1_0_16/PpgChannelDetector.h"
static_assert(PpgChannelConfig::CALIBRATION_SAMPLES == 50, "calibration");
static_assert(PpgChannelConfig::PROMINENCE_CAPACITY == 32, "fixed ring");

void setup() {
  PpgChannelDetector detector;
  detector.reset();
  PpgChannelObservation o = detector.update(100000, 40000);
  if (o.candidate || o.artifact) abort();
}
void loop() {}
```

Add `SELFTEST CHANNEL_WEAK`: generate 25 Hz DC `80000` plus a small periodic
waveform whose peak-valley prominence is below 25. After calibration require
`candidate_count >= 8` and `artifact_count == 0`.

Add `SELFTEST CHANNEL_OUTLIER`: four accepted-scale pulses, one amplitude at
seven times their median, then four normal pulses. Require one artifact and
normal candidates after recalibration; the outlier cannot train signal.

- [ ] **Step 2: Verify RED on the replay build**

```powershell
& 'C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' esp32/tests/test_biosys_1_0_16_ppg.py -v
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-replay-build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-replay-upload -Port COM3
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/replay-biosys-ppg.ps1 -Port COM3 -SelfTest CHANNEL_WEAK
```

Expected: missing detector or self-test behavior causes failure.

- [ ] **Step 3: Implement the fixed-memory detector**

```cpp
namespace PpgChannelConfig {
  constexpr uint8_t CALIBRATION_SAMPLES = 50;
  constexpr uint8_t PROMINENCE_CAPACITY = 32;
  constexpr float DC_ALPHA = 0.010f;
  constexpr float FILTER_ALPHA = 0.22f;
  constexpr float NOISE_ALPHA = 0.10f;
  constexpr float SIGNAL_ALPHA = 0.125f;
  constexpr float THRESHOLD_FRACTION = 0.35f;
}

struct PpgChannelObservation {
  uint64_t timestampUs;
  float filtered;
  float prominence;
  float threshold;
  float snr;
  bool calibrated;
  bool candidate;
  bool artifact;
};

class PpgChannelDetector {
 public:
  void reset();
  PpgChannelObservation update(uint32_t raw, uint64_t timestampUs);
  void confirmFused(float prominence);
  float signalToNoise() const;
};
```

Implement calibration percentiles, threshold
`noise + 0.35 * max(0, signal - noise)`, rejected-noise EMA, fused-only signal
EMA, and six-times-median outlier rejection. Use fixed arrays only.

- [ ] **Step 4: Verify GREEN**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-replay-build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-replay-upload -Port COM3
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/replay-biosys-ppg.ps1 -Port COM3 -SelfTest CHANNEL_WEAK
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/replay-biosys-ppg.ps1 -Port COM3 -SelfTest CHANNEL_OUTLIER
```

Expected: both self-tests report PASS.

- [ ] **Step 5: Commit channel detection**

```powershell
git add esp32/VitalWatch_BIOSYS_1_0_16/PpgChannelDetector.* esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp esp32/tests
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add adaptive PPG channel detector"
```

### Task 4: Fuse red and IR beats without single-channel authority

**Files:**
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/PpgBeatFusion.h`
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/PpgBeatFusion.cpp`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp`
- Modify: `esp32/tests/ppg_dual_channel_test/ppg_dual_channel_test.ino`

**Interfaces:**
- Consumes: two `PpgChannelObservation` values per sample.
- Produces: `PpgBeatFusion::update()` returning `PpgFusedBeat` and fixed IBI history.

- [ ] **Step 1: Add failing pairing, single-channel, gap, and rollover tests**

```cpp
struct PpgFusedBeat {
  uint64_t timestampUs;
  uint16_t ibiMs;
  float redProminence;
  float irProminence;
  bool fused;
  bool historyReset;
};

class PpgBeatFusion {
 public:
  void reset();
  PpgFusedBeat update(const PpgChannelObservation &red,
                      const PpgChannelObservation &ir);
  uint8_t ibiCount() const;
  uint8_t synchronizedCount() const;
  bool robustBpm(float &bpm, float &madRatio, uint16_t &rangeMs) const;
};
```

Required self-tests:

```text
FUSION_PAIRED: red/IR offset 80 ms => fused=1
FUSION_RED_ONLY: IR candidate absent => fused=0
FUSION_IR_ONLY: red candidate absent => fused=0
FUSION_TOO_FAR: offset 160 ms => fused=0
FUSION_LONG_GAP: IBI 1640 ms => historyReset=1 and ibiCount=0
FUSION_ROLLOVER: timestamps 4294920000 us and 4295680000 us => ibiMs=760
```

- [ ] **Step 2: Upload and verify RED**

Run the replay build/upload and all six `FUSION_*` cases. Expected: failure
because fusion is absent.

- [ ] **Step 3: Implement matching and IBI history**

Use `MATCH_WINDOW_US=120000`, `IBI_MIN_MS=330`, `IBI_MAX_MS=1600`, and
`IBI_CAPACITY=8`. Store timestamps as `uint64_t` and subtract before converting
to milliseconds. SparkFun peaks remain diagnostic only.

- [ ] **Step 4: Verify fusion GREEN**

```powershell
'FUSION_PAIRED','FUSION_RED_ONLY','FUSION_IR_ONLY','FUSION_TOO_FAR','FUSION_LONG_GAP','FUSION_ROLLOVER' | ForEach-Object {
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/replay-biosys-ppg.ps1 -Port COM3 -SelfTest $_
  if ($LASTEXITCODE -ne 0) { throw "Fallo $_" }
}
```

Expected: six PASS results.

- [ ] **Step 5: Commit beat fusion**

```powershell
git add esp32/VitalWatch_BIOSYS_1_0_16/PpgBeatFusion.* esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp esp32/tests/ppg_dual_channel_test
git -c user.name=Codex -c user.email=codex@local commit -m "feat: fuse synchronized red and IR beats"
```

### Task 5: Add optical and motion quarantine

**Files:**
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/PpgValidityGate.h`
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/PpgValidityGate.cpp`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/Configuracion.h`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp`
- Modify: `esp32/tests/ppg_dual_channel_test/ppg_dual_channel_test.ino`

**Interfaces:**
- Consumes: raw red/IR, `PpgMotionHint`, timing integrity, contact, and fused beats.
- Produces: `PpgGateDecision` and quality-reason bits.

- [ ] **Step 1: Add failing quarantine boundary tests**

```cpp
enum class PpgDetectorState : uint8_t {
  CALIBRATING, TRACKING, TECHNICALLY_VALID, QUARANTINED, NO_CONTACT
};

struct PpgGateDecision {
  PpgDetectorState state;
  HeartRateStatus status;
  float bpm;
  uint16_t qualityReasons;
  uint32_t quarantineRemainingMs;
};

class PpgValidityGate {
 public:
  void reset(PpgDetectorState state = PpgDetectorState::NO_CONTACT);
  PpgGateDecision update(const PPGSample &sample,
                         const PpgMotionHint &motion,
                         const PpgChannelObservation &red,
                         const PpgChannelObservation &ir,
                         const PpgFusedBeat &beat,
                         bool contact,
                         bool missingSamples);
};
```

Required cases:

```text
OPTICAL_7_PERCENT: one 7% step => no quarantine
OPTICAL_9_PERCENT: one 9% step => quarantine and QR_OPTICAL_TRANSIENT
MOTION_ONE_MODERATE: one deltaG=0.05 => no quarantine
MOTION_THREE_MODERATE: three deltaG=0.05 => quarantine and QR_HIGH_MOTION
MOTION_SEVERE: one gyro=0.75 => immediate quarantine
MOTION_SATURATED: saturated=1 => immediate quarantine
RECOVERY_RESTART: artifact at 3990 ms => recovery clock restarts
```

- [ ] **Step 2: Verify RED on replay firmware**

Build/upload and run all seven cases. Expected: failure because the gate is
absent.

- [ ] **Step 3: Implement gate and new reason bits**

```cpp
QR_OPTICAL_TRANSIENT     = 1u << 8,
QR_CHANNEL_MISMATCH      = 1u << 9,
QR_DETECTOR_CALIBRATING  = 1u << 10
```

Implement 8% optical step; three moderate motion samples; severe motion
immediate; 4000 ms quiet quarantine; then 50-sample calibration. Quarantine
clears fusion/IBI and returns BPM `NAN`.

- [ ] **Step 4: Verify quarantine tests GREEN**

Run the seven cases plus Task 4 fusion tests. Expected: all PASS.

- [ ] **Step 5: Commit quarantine logic**

```powershell
git add esp32/VitalWatch_BIOSYS_1_0_16/PpgValidityGate.* esp32/VitalWatch_BIOSYS_1_0_16/Configuracion.h esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp esp32/tests
git -c user.name=Codex -c user.email=codex@local commit -m "feat: quarantine PPG contact and motion artifacts"
```

### Task 6: Integrate technical validity into the production PPG service

**Files:**
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/Sensor_Oxigeno.h`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/Sensor_Oxigeno.cpp`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/VitalWatch_BIOSYS_1_0_16.ino`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp`
- Modify: `esp32/tests/test_biosys_1_0_16_ppg.py`

**Interfaces:**
- Consumes: channel observations, fused beats, and gate decisions from Tasks 3–5.
- Produces: existing `HeartRateResult`, display result, and telemetry result contracts.

- [ ] **Step 1: Add failing public-result tests**

Required replay cases:

```text
VALID_STABLE_SYNTHETIC: 12 s paired 80 bpm after calibration => VALID >= 5 s
INVALID_TIMING_FALSE: timing_valid=0 => TIMING_INVALID and bpm=nan
INVALID_SEQUENCE_GAP: sequence jumps by 2 => IBI cleared and no VALID
INVALID_TIME_REVERSE: sample_time_us decreases => TIMING_INVALID and no VALID
INVALID_CHANNEL_RATIO: only 5 of last 8 candidates paired => UNSTABLE, not VALID
INVALID_SNR: either channel SNR=1.49 => LOW_QUALITY, not VALID
VALID_SNR_BOUNDARY: both channel SNR=1.50 => may become VALID after all gates
RESET_AFTER_VALID: RESET after a valid run => NO_CONTACT and bpm=nan
```

The stable case also asserts at least six IBI, BPM 80, MAD ratio at most 0.12,
IBI range at most 300 ms, and 5000 ms continuously clean.

- [ ] **Step 2: Verify RED**

Run the eight cases on the uploaded replay firmware. Expected: the stable
synthetic case does not become valid and new boundary reasons are absent.

- [ ] **Step 3: Replace old custom authority with the new pipeline**

Integrate exactly once per PPG sample:

```cpp
const PpgChannelObservation redObservation =
  redDetector.update(s.red, s.sampleTimeUs);
const PpgChannelObservation irObservation =
  irDetector.update(s.ir, s.sampleTimeUs);
const PpgFusedBeat beat = beatFusion.update(redObservation, irObservation);
if (beat.fused) {
  redDetector.confirmFused(beat.redProminence);
  irDetector.confirmFused(beat.irProminence);
}
const PpgGateDecision decision = validityGate.update(
  s, motionHint, redObservation, irObservation, beat, contact,
  diag.missingSamplesInWindow);
applyHeartRateDecision(decision, s.sampleTimeUs);
```

Remove `prev1 > 8`, amplitude floor `25`, and SparkFun-only insertion into
`acceptPeak()`. Retain `checkForBeat()` only as a research diagnostic. Keep
SpO2/MAXIM experimental and separate.

- [ ] **Step 4: Make all result cases GREEN**

Build/upload and run Task 3–6 self-tests. Expected: all PASS.

- [ ] **Step 5: Verify stale-result removal explicitly**

Run `VALID_STABLE_SYNTHETIC`, then `OPTICAL_9_PERCENT`, then `RESET` without
reboot. Expected: prior BPM disappears immediately; quarantine and reset expose
`NAN`; the next run starts in calibration.

- [ ] **Step 6: Commit production integration**

```powershell
git add esp32/VitalWatch_BIOSYS_1_0_16/Sensor_Oxigeno.* esp32/VitalWatch_BIOSYS_1_0_16/VitalWatch_BIOSYS_1_0_16.ino esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp esp32/tests
git -c user.name=Codex -c user.email=codex@local commit -m "feat: gate technical heart-rate validity"
```

### Task 7: Extend diagnostics and replay the physical datasets

**Files:**
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/Sensor_Oxigeno.h`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/BioResearch.h`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/BioResearch.cpp`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/BioReplay.cpp`
- Modify: `scripts/capture-biosys-research.ps1`
- Modify: `scripts/test-biosys-ppg-replay.mjs`
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md`

**Interfaces:**
- Consumes: detector/gate diagnostics and four immutable 1.0.15 CSVs.
- Produces: appended research columns and pass/fail replay reports.

- [ ] **Step 1: Write failing schema and dataset assertions**

Require appended columns, preserving all existing columns and their order:

```text
red_prominence,red_threshold,red_snr,red_candidate,
ir_prominence,ir_threshold,ir_snr,ir_candidate,
peak_fused,detector_state,quarantine_remaining_ms,synchronized_count
```

Add Node assertions:

```js
assert.equal(noFinger.valid, 0);
assert.equal(noFinger.fused, 0);
assert.ok(stableTimeline.longestValidMs >= 10000);
assert.ok(stableTimeline.bpmMedian >= 75 && stableTimeline.bpmMedian <= 95);
assert.equal(stableTimeline.validWithUnsafeFlags, 0);
assert.equal(led35Stable.singleChannelValid, 0);
assert.equal(contactChange.validDuringQuarantine, 0);
assert.ok(contactChange.recalibrationCount >= 1);
```

- [ ] **Step 2: Verify RED against current summary/schema**

Run Node and Python tests. Expected: missing diagnostic fields fail.

- [ ] **Step 3: Append diagnostics and update capture destination**

Extend `PPGDiagnostics` with fixed scalar fields only. Update CSV serializer and
capture header together. Store new captures in `measurements/biosys-1.0.16` and
never rewrite the 1.0.15 fixtures.

- [ ] **Step 4: Build/upload replay and run four CODEX datasets**

```powershell
$cases = @(
  @{ File='measurements/biosys-1.0.15/20260924-191425-sin-dedo-led-range-a.csv'; Label='no-finger' },
  @{ File='measurements/biosys-1.0.15/20260924-194014-dedo-quieto-timeline-a-toma-1.csv'; Label='stable-timeline' },
  @{ File='measurements/biosys-1.0.15/20260924-195431-dedo-quieto-led-35-timeline-a-toma-1.csv'; Label='led35-stable' },
  @{ File='measurements/biosys-1.0.15/20260924-195710-dedo-quieto-led-35-timeline-a-toma-2.csv'; Label='contact-change' }
)
foreach ($case in $cases) {
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/replay-biosys-ppg.ps1 -Port COM3 -InputCsv $case.File -OutputPath "measurements/biosys-1.0.16/replay-$($case.Label).log"
  if ($LASTEXITCODE -ne 0) { throw "Replay failed: $($case.Label)" }
}
node --test scripts/test-biosys-ppg-replay.mjs
```

Expected: all dataset assertions PASS. If stable timeline fails, return to the
single failing detector hypothesis; do not relax multiple gates together.

- [ ] **Step 5: Document replay evidence**

Record per dataset: SHA-256, rows, fused beats, valid samples, first-valid time,
longest-valid duration, BPM median/range, quarantine count, recalibration count,
unsafe-valid count, and verdict. Mark agreements `INDEPENDENTLY REPRODUCED`.

- [ ] **Step 6: Commit diagnostics and replay results**

```powershell
git add esp32/VitalWatch_BIOSYS_1_0_16 scripts/capture-biosys-research.ps1 scripts/test-biosys-ppg-replay.mjs measurements/biosys-1.0.16
git -c user.name=Codex -c user.email=codex@local commit -m "test: validate dual-channel PPG against physical replays"
```

### Task 8: Complete regressions, memory audit, and release documentation

**Files:**
- Modify: `package.json`
- Modify: `scripts/esp32-firmware.ps1`
- Create: `esp32/VitalWatch_BIOSYS_1_0_16/CAMBIOS_1_0_16.md`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/MANIFEST.md`
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/README.md`
- Test: all firmware and app suites

**Interfaces:**
- Consumes: completed 1.0.16 firmware and replay evidence.
- Produces: normal/research/replay builds and exact size/hash report.

- [ ] **Step 1: Add failing final contract tests**

Assert package scripts exist for `firmware:biosys:replay` and
`firmware:biosys:replay:upload`; every build path names 1.0.16; the manifest
names the new detector files; and the change log says technical, not clinical,
validity.

- [ ] **Step 2: Verify RED, then update tooling and documentation**

Run Python guards, observe missing final contracts, then make only those
tooling/documentation changes.

- [ ] **Step 3: Run firmware tests and three builds**

```powershell
& 'C:\Users\Usuario\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s esp32/tests -p 'test_*.py' -v
node --test scripts/test-biosys-ppg-replay.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-research-build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-replay-build
```

Expected: zero failures and three successful builds.

- [ ] **Step 4: Run app regressions without changing Expo code**

```powershell
npm run test:readings
npm run test:medications
npm run test:telegram
npm run lint
```

Expected: zero failures. Any unrelated pre-existing lint failure is reported by
name and not hidden.

- [ ] **Step 5: Audit hashes and memory**

```powershell
Get-FileHash esp32/VitalWatch_BIOSYS_1_0_15/Sensor_Movimiento.cpp,esp32/VitalWatch_BIOSYS_1_0_16/Sensor_Movimiento.cpp -Algorithm SHA256
Get-FileHash esp32/VitalWatch_BIOSYS_1_0_15/Sensor_Movimiento.h,esp32/VitalWatch_BIOSYS_1_0_16/Sensor_Movimiento.h -Algorithm SHA256
Get-FileHash esp32/VitalWatch_BIOSYS_1_0_15/PpgSampleTimeline.h,esp32/VitalWatch_BIOSYS_1_0_16/PpgSampleTimeline.h -Algorithm SHA256
```

Compare research 1.0.16 with baseline flash `1182072` and RAM `59040`. Stop
for review if growth exceeds 12288 flash or 2048 RAM.

- [ ] **Step 6: Commit release-candidate documentation**

```powershell
git add package.json scripts/esp32-firmware.ps1 esp32/VitalWatch_BIOSYS_1_0_16
git -c user.name=Codex -c user.email=codex@local commit -m "docs: finalize BIOSYS 1.0.16 PPG candidate"
```

### Task 9: Perform controlled physical validation and release decision

**Files:**
- Create: `measurements/biosys-1.0.16/<timestamp>-dedo-quieto-dual-channel-a-toma-1.csv`
- Create: matching metadata JSON
- Modify: `esp32/VitalWatch_BIOSYS_1_0_16/RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md`

**Interfaces:**
- Consumes: verified research build and classic ESP32 NodeMCU 38-pin board.
- Produces: one immutable 90-second capture and explicit release/no-release verdict.

- [ ] **Step 1: Confirm target and upload research firmware**

```powershell
npm run firmware:ports
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-research-upload -Port COM3
```

If upload waits at `Connecting...`, ask the user to hold IO0/BOOT, tap EN/RESET,
release EN, then release IO0 when writing begins. Do not erase flash outside the
normal uploader.

- [ ] **Step 2: Verify startup identity**

Open at 460800 and require:

```text
VitalWatch VW-BIOSYS 1.0.16
VW-SYS 0.9.9
VW-BIO 0.7.0
PPG-DUAL-CHANNEL-A
MAX30102 PART_ID=0x15
```

Close the monitor before capture so one process owns COM3.

- [ ] **Step 3: Capture 90 controlled seconds**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-biosys-research.ps1 -Port COM3 -DurationSeconds 90 -Label dedo-quieto-dual-channel-a-toma-1
```

The user keeps the finger still, pressure constant, and hand supported. No
claim is made about clinical BPM accuracy.

- [ ] **Step 4: Apply the physical acceptance gate**

The capture passes only if:

```text
records >= 2200
discarded records == 0
timestamp deltas == 40000 us for every consecutive sequence
suspected_drops == 0
longest VALID segment >= 10000 ms
VALID samples with QR_HIGH_MOTION == 0
VALID samples with QR_OPTICAL_TRANSIENT == 0
VALID samples with QR_TIMING_INVALID == 0
red/IR fused contribution present for every VALID beat
```

If any line fails, keep the research build, document one failing hypothesis,
and do not install or label the normal build as complete.

- [ ] **Step 5: Build and upload normal firmware only after a pass**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-upload -Port COM3
```

Record the binary SHA-256 in the results document.

- [ ] **Step 6: Commit physical evidence and verdict**

```powershell
git add measurements/biosys-1.0.16 esp32/VitalWatch_BIOSYS_1_0_16/RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md
git -c user.name=Codex -c user.email=codex@local commit -m "test: record BIOSYS 1.0.16 physical PPG validation"
```

## Completion Criteria

Implementation is complete only when Tasks 1–8 are green and Task 9 produces a
physical capture satisfying every acceptance line. A successful build or an
approximately plausible BPM is not sufficient. If replay passes but physical
validation fails, BIOSYS 1.0.16 remains an unreleased research candidate and
the report states that outcome directly.
