#ifndef VITALWATCH_PPG_CHANNEL_DETECTOR_H
#define VITALWATCH_PPG_CHANNEL_DETECTOR_H

#include <Arduino.h>

namespace PpgChannelConfig {
  constexpr uint8_t CALIBRATION_SAMPLES=50;
  constexpr uint8_t PROMINENCE_CAPACITY=32;
  constexpr uint8_t FIR_SHORT_SAMPLES=7;
  constexpr uint8_t FIR_LONG_SAMPLES=20;
  constexpr uint8_t NMS_CAPACITY=16;
  // Un periodo refractario de 320 ms conserva el limite tecnico de 190 lpm
  // sin permitir que varios maximos cercanos representen el mismo pulso.
  constexpr uint32_t NMS_RADIUS_US=320000UL;
  constexpr float NOISE_ALPHA=0.10f;
  constexpr float SIGNAL_ALPHA=0.125f;
  // El umbral sensible genera candidatos; la validez sigue protegida por
  // fusion rojo/IR, SNR, coherencia IBI, tiempo limpio y cuarentena.
  constexpr float THRESHOLD_FRACTION=0.05f;
}

struct PpgChannelObservation {
  uint64_t timestampUs;
  uint64_t observedAtUs;
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
  float filteredSample() const;
  void addPendingMaximum(uint64_t timestampUs,float prominence);
  bool emitMaturedMaximum(uint64_t observedAtUs,PpgChannelObservation &observation);

  bool initialized_;
  bool calibrated_;
  uint16_t calibrationSamples_;
  uint8_t calibrationCount_;
  uint8_t calibrationPosition_;
  float calibration_[PpgChannelConfig::PROMINENCE_CAPACITY];
  uint32_t raw_[PpgChannelConfig::FIR_LONG_SAMPLES];
  uint8_t rawCount_;
  uint8_t rawPosition_;
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
  uint64_t pendingTimes_[PpgChannelConfig::NMS_CAPACITY];
  float pendingProminences_[PpgChannelConfig::NMS_CAPACITY];
  bool pendingSuppressed_[PpgChannelConfig::NMS_CAPACITY];
  uint8_t pendingCount_;
};

#endif
