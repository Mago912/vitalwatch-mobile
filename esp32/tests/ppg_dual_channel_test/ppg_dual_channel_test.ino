#include "../../VitalWatch_BIOSYS_1_0_16/PpgChannelDetector.h"
#include "../../VitalWatch_BIOSYS_1_0_16/PpgChannelDetector.cpp"

static_assert(PpgChannelConfig::CALIBRATION_SAMPLES == 50, "calibration");
static_assert(PpgChannelConfig::PROMINENCE_CAPACITY == 32, "fixed ring");

namespace {
uint32_t weakWave(uint32_t index) {
  static const int8_t shape[25] = {
    0, 1, 2, 4, 7, 11, 8, 5, 3, 1, 0, -1, -2,
    -3, -4, -5, -4, -3, -2, -1, 0, 0, 0, 0, 0
  };
  return (uint32_t)(80000 + shape[index % 25]);
}

uint32_t pulseWave(uint32_t index, uint16_t amplitude) {
  static const uint8_t shape[25] = {
    0, 0, 1, 3, 6, 10, 7, 4, 2, 1, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
  };
  return 80000UL + ((uint32_t)shape[index % 25] * amplitude) / 10UL;
}

bool channelWeak() {
  PpgChannelDetector detector;
  detector.reset();
  uint16_t candidates=0,artifacts=0;
  for(uint32_t index=0;index<350;++index){
    const uint32_t raw=index<60?80000UL:weakWave(index-60);
    const PpgChannelObservation observation=detector.update(
      raw,(uint64_t)index*40000ULL
    );
    if(observation.candidate){++candidates;detector.confirmFused(observation.prominence);}
    if(observation.artifact)++artifacts;
  }
  return candidates>=8 && artifacts==0;
}

bool channelOutlier() {
  PpgChannelDetector detector;
  detector.reset();
  uint16_t candidates=0,artifacts=0,normalAfterOutlier=0;
  for(uint32_t index=0;index<60;++index)
    detector.update(80000UL,(uint64_t)index*40000ULL);

  for(uint8_t pulse=0;pulse<9;++pulse){
    const uint16_t amplitude=pulse==4?840:120;
    for(uint8_t phase=0;phase<25;++phase){
      const uint32_t index=60UL+(uint32_t)pulse*25UL+phase;
      const PpgChannelObservation observation=detector.update(
        pulseWave(phase,amplitude),(uint64_t)index*40000ULL
      );
      if(observation.artifact)++artifacts;
      if(observation.candidate){
        ++candidates;
        if(pulse>4)++normalAfterOutlier;
        detector.confirmFused(observation.prominence);
      }
    }
  }
  return candidates>=8 && artifacts==1 && normalAfterOutlier>=4;
}
}

void setup() {
  PpgChannelDetector detector;
  detector.reset();
  const PpgChannelObservation observation=detector.update(100000,40000);
  if(observation.candidate || observation.artifact)abort();
  if(!channelWeak() || !channelOutlier())abort();
}

void loop() {}
