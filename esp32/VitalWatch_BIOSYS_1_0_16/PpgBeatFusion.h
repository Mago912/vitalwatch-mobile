#ifndef VITALWATCH_PPG_BEAT_FUSION_H
#define VITALWATCH_PPG_BEAT_FUSION_H

#include <Arduino.h>
#include "PpgChannelDetector.h"

namespace PpgFusionConfig {
  constexpr uint32_t MATCH_WINDOW_US=120000UL;
  constexpr uint16_t IBI_MIN_MS=330;
  constexpr uint16_t IBI_MAX_MS=1600;
  constexpr uint8_t IBI_CAPACITY=8;
}

struct PpgFusedBeat {
  uint64_t timestampUs;
  uint16_t ibiMs;
  float redProminence;
  float irProminence;
  bool fused;
  bool historyReset;
  uint8_t ibiCount;
  uint8_t synchronizedCount;
  uint8_t synchronizationWindowSize;
  float bpm;
  float madRatio;
  uint16_t rangeMs;
};

class PpgBeatFusion {
 public:
  PpgBeatFusion();
  void reset();
  PpgFusedBeat update(const PpgChannelObservation &red,
                      const PpgChannelObservation &ir);
  uint8_t ibiCount() const;
  uint8_t synchronizedCount() const;
  bool robustBpm(float &bpm,float &madRatio,uint16_t &rangeMs) const;

 private:
  void recordSynchronization(bool synchronized);
  PpgFusedBeat acceptPair();
  PpgFusedBeat resultWithMetrics(const PpgFusedBeat &result) const;
  static uint64_t absoluteDifference(uint64_t left,uint64_t right);

  bool pendingRed_;
  bool pendingIr_;
  PpgChannelObservation red_;
  PpgChannelObservation ir_;
  uint64_t lastFusedUs_;
  uint16_t ibis_[PpgFusionConfig::IBI_CAPACITY];
  uint8_t ibiCount_;
  uint8_t ibiPosition_;
  bool synchronized_[PpgFusionConfig::IBI_CAPACITY];
  uint8_t synchronizedSize_;
  uint8_t synchronizedPosition_;
};

#endif
