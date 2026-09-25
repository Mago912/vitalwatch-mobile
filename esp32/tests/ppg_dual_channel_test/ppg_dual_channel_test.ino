#include "../../VitalWatch_BIOSYS_1_0_16/PpgChannelDetector.h"
#include "../../VitalWatch_BIOSYS_1_0_16/PpgChannelDetector.cpp"
#include "../../VitalWatch_BIOSYS_1_0_16/PpgBeatFusion.h"
#include "../../VitalWatch_BIOSYS_1_0_16/PpgBeatFusion.cpp"
#include "../../VitalWatch_BIOSYS_1_0_16/PpgValidityGate.h"
#include "../../VitalWatch_BIOSYS_1_0_16/PpgValidityGate.cpp"

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
  for(uint32_t index=0;index<400;++index){
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

  // Cuatro pulsos calibran percentiles; cinco normales garantizan cuatro
  // fusiones para la mediana, el decimo es el outlier y luego hay cinco normales.
  for(uint8_t pulse=0;pulse<15;++pulse){
    const uint16_t amplitude=pulse==9?840:120;
    for(uint8_t phase=0;phase<25;++phase){
      const uint32_t index=60UL+(uint32_t)pulse*25UL+phase;
      const PpgChannelObservation observation=detector.update(
        pulseWave(phase,amplitude),(uint64_t)index*40000ULL
      );
      if(observation.artifact)++artifacts;
      if(observation.candidate){
        ++candidates;
        if(pulse>9)++normalAfterOutlier;
        detector.confirmFused(observation.prominence);
      }
    }
  }
  return candidates>=8 && artifacts==1 && normalAfterOutlier>=4;
}

PpgChannelObservation candidate(uint64_t timestampUs,bool present=true){
  return {timestampUs,timestampUs,0,100,10,10,true,present,false};
}

bool fusionPaired(){
  PpgBeatFusion fusion;
  fusion.reset();
  return fusion.update(candidate(1000000),candidate(1080000)).fused;
}

bool fusionRedOnly(){
  PpgBeatFusion fusion;
  fusion.reset();
  return !fusion.update(candidate(1000000),candidate(1000000,false)).fused;
}

bool fusionIrOnly(){
  PpgBeatFusion fusion;
  fusion.reset();
  return !fusion.update(candidate(1000000,false),candidate(1000000)).fused;
}

bool fusionTooFar(){
  PpgBeatFusion fusion;
  fusion.reset();
  return !fusion.update(candidate(1000000),candidate(1160000)).fused;
}

bool fusionLongGap(){
  PpgBeatFusion fusion;
  fusion.reset();
  fusion.update(candidate(1000000),candidate(1000000));
  const PpgFusedBeat result=fusion.update(candidate(2640000),candidate(2640000));
  return result.fused&&result.historyReset&&fusion.ibiCount()==0;
}

bool fusionRollover(){
  PpgBeatFusion fusion;
  fusion.reset();
  fusion.update(candidate(4294920000ULL),candidate(4294920000ULL));
  const PpgFusedBeat result=fusion.update(
    candidate(4295680000ULL),candidate(4295680000ULL)
  );
  return result.fused&&result.ibiMs==760;
}

PPGSample gateSample(uint64_t timestampUs,uint32_t red=100000,uint32_t ir=100000){
  return {red,ir,(uint32_t)(timestampUs/40000ULL),timestampUs,true};
}

PpgMotionHint gateMotion(float deltaG=0,float gyro=0,bool saturated=false){
  return {deltaG,gyro,saturated,true};
}

PpgGateDecision gateUpdate(PpgValidityGate &gate,const PPGSample &sample,
                           const PpgMotionHint &motion=gateMotion()){
  return gate.update(sample,motion,candidate(sample.sampleTimeUs,false),
    candidate(sample.sampleTimeUs,false),PpgFusedBeat{},true,false);
}

bool optical7Percent(){
  PpgValidityGate gate;gate.reset(PpgDetectorState::TRACKING);
  gateUpdate(gate,gateSample(1000000));
  return gateUpdate(gate,gateSample(1040000,107000,107000)).state!=
    PpgDetectorState::QUARANTINED;
}

bool optical9Percent(){
  PpgValidityGate gate;gate.reset(PpgDetectorState::TRACKING);
  gateUpdate(gate,gateSample(1000000));
  const PpgGateDecision result=gateUpdate(gate,gateSample(1040000,109001,109001));
  return result.state==PpgDetectorState::QUARANTINED&&
    (result.qualityReasons&QR_OPTICAL_TRANSIENT)!=0;
}

bool motionOneModerate(){
  PpgValidityGate gate;gate.reset(PpgDetectorState::TRACKING);
  gateUpdate(gate,gateSample(1000000));
  return gateUpdate(gate,gateSample(1040000),gateMotion(0.05f)).state!=
    PpgDetectorState::QUARANTINED;
}

bool motionThreeModerate(){
  PpgValidityGate gate;gate.reset(PpgDetectorState::TRACKING);
  gateUpdate(gate,gateSample(1000000));
  gateUpdate(gate,gateSample(1040000),gateMotion(0.05f));
  gateUpdate(gate,gateSample(1080000),gateMotion(0.05f));
  const PpgGateDecision result=gateUpdate(
    gate,gateSample(1120000),gateMotion(0.05f)
  );
  return result.state==PpgDetectorState::QUARANTINED&&
    (result.qualityReasons&QR_HIGH_MOTION)!=0;
}

bool motionSevere(){
  PpgValidityGate gate;gate.reset(PpgDetectorState::TRACKING);
  gateUpdate(gate,gateSample(1000000));
  return gateUpdate(gate,gateSample(1040000),gateMotion(0,0.75f)).state==
    PpgDetectorState::QUARANTINED;
}

bool motionSaturated(){
  PpgValidityGate gate;gate.reset(PpgDetectorState::TRACKING);
  gateUpdate(gate,gateSample(1000000));
  return gateUpdate(gate,gateSample(1040000),gateMotion(0,0,true)).state==
    PpgDetectorState::QUARANTINED;
}

bool recoveryRestart(){
  PpgValidityGate gate;gate.reset(PpgDetectorState::TRACKING);
  gateUpdate(gate,gateSample(1000000));
  gateUpdate(gate,gateSample(1040000),gateMotion(0,0.75f));
  gateUpdate(gate,gateSample(5030000),gateMotion(0,0.75f));
  const PpgGateDecision before=gateUpdate(gate,gateSample(9020000));
  const PpgGateDecision after=gateUpdate(gate,gateSample(9040000));
  return before.state==PpgDetectorState::QUARANTINED&&
    before.quarantineRemainingMs>0&&
    after.state==PpgDetectorState::CALIBRATING;
}
}

void setup() {
  PpgChannelDetector detector;
  detector.reset();
  const PpgChannelObservation observation=detector.update(100000,40000);
  if(observation.candidate || observation.artifact)abort();
  if(!channelWeak() || !channelOutlier() || !fusionPaired() ||
     !fusionRedOnly() || !fusionIrOnly() || !fusionTooFar() ||
     !fusionLongGap() || !fusionRollover() || !optical7Percent() ||
     !optical9Percent() || !motionOneModerate() || !motionThreeModerate() ||
     !motionSevere() || !motionSaturated() || !recoveryRestart())abort();
}

void loop() {}
