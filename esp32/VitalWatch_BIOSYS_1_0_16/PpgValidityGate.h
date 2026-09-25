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

  PpgDetectorState state_;
  uint16_t reasons_;
  uint32_t previousRed_;
  uint32_t previousIr_;
  bool previousOpticalValid_;
  uint8_t moderateMotionCount_;
  uint64_t quietStartedUs_;
  uint64_t lastTimestampUs_;
};

#endif
