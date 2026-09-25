#ifndef VITALWATCH_PPG_CHANNEL_DETECTOR_H
#define VITALWATCH_PPG_CHANNEL_DETECTOR_H

#include <Arduino.h>

namespace PpgChannelConfig {
  constexpr uint8_t CALIBRATION_SAMPLES=50;
  constexpr uint8_t PROMINENCE_CAPACITY=32;
  constexpr float DC_ALPHA=0.010f;
  constexpr float FILTER_ALPHA=0.22f;
  constexpr float NOISE_ALPHA=0.10f;
  constexpr float SIGNAL_ALPHA=0.125f;
  constexpr float THRESHOLD_FRACTION=0.35f;
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
  PpgChannelDetector();
  void reset();
  PpgChannelObservation update(uint32_t raw,uint64_t timestampUs);
  void confirmFused(float prominence);
  float signalToNoise() const;

 private:
  void finishCalibration();
  float medianFusedProminence() const;
  float threshold() const;

  bool initialized_;
  bool calibrated_;
  uint8_t calibrationCount_;
  float calibration_[PpgChannelConfig::CALIBRATION_SAMPLES];
  float dc_;
  float filtered_;
  float previous1_;
  float previous2_;
  float valley_;
  uint64_t previousTimestampUs_;
  float noise_;
  float signal_;
  float fusedProminences_[PpgChannelConfig::PROMINENCE_CAPACITY];
  uint8_t fusedCount_;
  uint8_t fusedPosition_;
};

#endif
