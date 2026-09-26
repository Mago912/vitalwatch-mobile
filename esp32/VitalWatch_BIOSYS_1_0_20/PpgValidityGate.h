#ifndef VITALWATCH_PPG_VALIDITY_GATE_H
#define VITALWATCH_PPG_VALIDITY_GATE_H

#include <Arduino.h>
#include "Sensor_Oxigeno.h"
#include "PpgChannelDetector.h"
#include "PpgBeatFusion.h"

namespace PpgGateConfig {
  constexpr uint32_t CONTACT_THRESHOLD=14000UL;
  constexpr float OPTICAL_STEP_RATIO=0.08f;
  constexpr float MODERATE_DELTA_G=0.05f;
  constexpr float MODERATE_GYRO_RAD_S=0.10f;
  constexpr uint8_t MODERATE_SAMPLES=3;
  constexpr float SEVERE_DELTA_G=0.20f;
  constexpr float SEVERE_GYRO_RAD_S=0.75f;
  constexpr uint32_t QUARANTINE_QUIET_US=4000000UL;
  constexpr uint32_t CLEAN_REQUIRED_US=5000000UL;
  constexpr float SNR_MIN=1.50f;
  constexpr float MAD_RATIO_MAX=0.12f;
  constexpr uint16_t IBI_RANGE_MAX_MS=300;
  constexpr uint8_t MIN_IBI_COUNT=6;
  constexpr uint8_t MIN_SYNCHRONIZED=6;
  // La muneca agrega variaciones opticas aun estando quieta. Una salida no se
  // publica como valida hasta observar cinco estimaciones robustas cercanas
  // durante al menos 2,5 segundos.
  constexpr uint8_t BPM_CONFIRMATION_COUNT=5;
  constexpr float BPM_CONFIRMATION_RANGE_MAX=12.0f;
  constexpr uint32_t BPM_CONFIRMATION_MIN_US=2500000UL;
}

enum class PpgDetectorState : uint8_t {
  CALIBRATING,
  TRACKING,
  TECHNICALLY_VALID,
  QUARANTINED,
  NO_CONTACT
};

struct PpgGateDecision {
  PpgDetectorState state;
  HeartRateStatus status;
  float bpm;
  uint16_t qualityReasons;
  uint32_t quarantineRemainingMs;
  bool resetPipeline;
};

class PpgValidityGate {
 public:
  PpgValidityGate();
  void reset(PpgDetectorState state=PpgDetectorState::NO_CONTACT);
  PpgGateDecision update(const PPGSample &sample,
                         const PpgMotionHint &motion,
                         const PpgChannelObservation &red,
                         const PpgChannelObservation &ir,
                         const PpgFusedBeat &beat,
                         bool contact,
                         bool missingSamples);

 private:
  static float relativeStep(uint32_t current,uint32_t previous);
  PpgGateDecision decision(bool resetPipeline=false) const;
  void enterQuarantine(uint64_t timestampUs,uint16_t reasons);
  void clearBpmConfirmation();
  void addBpmCandidate(float bpm,uint64_t timestampUs);
  bool confirmedBpm(float &bpm) const;

  PpgDetectorState state_;
  uint16_t reasons_;
  uint32_t previousRed_;
  uint32_t previousIr_;
  bool previousOpticalValid_;
  uint8_t moderateMotionCount_;
  uint64_t quietStartedUs_;
  uint64_t cleanStartedUs_;
  uint64_t lastTimestampUs_;
  float publishedBpm_;
  float bpmCandidates_[PpgGateConfig::BPM_CONFIRMATION_COUNT];
  uint8_t bpmCandidateCount_;
  uint8_t bpmCandidatePosition_;
  uint64_t bpmConfirmationStartedUs_;
  uint64_t bpmConfirmationLastUs_;
};

#endif
