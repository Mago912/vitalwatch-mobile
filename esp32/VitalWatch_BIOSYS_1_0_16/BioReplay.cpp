#include "BioReplay.h"
#include "Configuracion.h"
#include "Sensor_Oxigeno.h"
#include "PpgChannelDetector.h"
#include "PpgBeatFusion.h"
#include "PpgValidityGate.h"

#include <math.h>
#include <stdio.h>
#include <string.h>

#if BIO_REPLAY_MODE
namespace {
char line[192];
size_t lineLength=0;
uint32_t accepted=0,rejected=0,validSamples=0;
uint64_t firstValidUs=0,validSpanStartUs=0;
uint32_t longestValidMs=0;
float bpmMin=NAN,bpmMax=NAN;

uint32_t weakWave(uint32_t index){
  static const int8_t shape[25]={
    0,1,2,4,7,11,8,5,3,1,0,-1,-2,-3,-4,-5,-4,-3,-2,-1,0,0,0,0,0
  };
  return (uint32_t)(80000+shape[index%25]);
}

uint32_t pulseWave(uint32_t index,uint16_t amplitude){
  static const uint8_t shape[25]={
    0,0,1,3,6,10,7,4,2,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
  };
  return 80000UL+((uint32_t)shape[index%25]*amplitude)/10UL;
}

bool selfTestChannelWeak(uint16_t &candidates,uint16_t &artifacts){
  PpgChannelDetector detector;
  detector.reset();
  candidates=artifacts=0;
  for(uint32_t index=0;index<400;++index){
    const uint32_t raw=index<60?80000UL:weakWave(index-60);
    const PpgChannelObservation observation=detector.update(
      raw,(uint64_t)index*40000ULL
    );
    if(observation.candidate){++candidates;detector.confirmFused(observation.prominence);}
    if(observation.artifact)++artifacts;
  }
  return candidates>=8&&artifacts==0;
}

bool selfTestChannelOutlier(uint16_t &candidates,uint16_t &artifacts,
                            uint16_t &normalAfterOutlier){
  PpgChannelDetector detector;
  detector.reset();
  candidates=artifacts=normalAfterOutlier=0;
  for(uint32_t index=0;index<60;++index)
    detector.update(80000UL,(uint64_t)index*40000ULL);
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
  return candidates>=8&&artifacts==1&&normalAfterOutlier>=4;
}

PpgChannelObservation fusionObservation(uint64_t timestampUs,bool present=true){
  return {timestampUs,0,100,10,10,true,present,false};
}

bool runFusionSelfTest(const char *name,PpgFusedBeat &result,
                       uint8_t &ibiCount,uint8_t &synchronizedCount){
  PpgBeatFusion fusion;
  fusion.reset();
  if(strcmp(name,"FUSION_PAIRED")==0){
    result=fusion.update(fusionObservation(1000000),fusionObservation(1080000));
    ibiCount=fusion.ibiCount();synchronizedCount=fusion.synchronizedCount();
    return result.fused;
  }
  if(strcmp(name,"FUSION_RED_ONLY")==0){
    result=fusion.update(fusionObservation(1000000),fusionObservation(1000000,false));
    ibiCount=fusion.ibiCount();synchronizedCount=fusion.synchronizedCount();
    return !result.fused;
  }
  if(strcmp(name,"FUSION_IR_ONLY")==0){
    result=fusion.update(fusionObservation(1000000,false),fusionObservation(1000000));
    ibiCount=fusion.ibiCount();synchronizedCount=fusion.synchronizedCount();
    return !result.fused;
  }
  if(strcmp(name,"FUSION_TOO_FAR")==0){
    result=fusion.update(fusionObservation(1000000),fusionObservation(1160000));
    ibiCount=fusion.ibiCount();synchronizedCount=fusion.synchronizedCount();
    return !result.fused;
  }
  if(strcmp(name,"FUSION_LONG_GAP")==0){
    fusion.update(fusionObservation(1000000),fusionObservation(1000000));
    result=fusion.update(fusionObservation(2640000),fusionObservation(2640000));
    ibiCount=fusion.ibiCount();synchronizedCount=fusion.synchronizedCount();
    return result.fused&&result.historyReset&&ibiCount==0;
  }
  if(strcmp(name,"FUSION_ROLLOVER")==0){
    fusion.update(fusionObservation(4294920000ULL),fusionObservation(4294920000ULL));
    result=fusion.update(
      fusionObservation(4295680000ULL),fusionObservation(4295680000ULL)
    );
    ibiCount=fusion.ibiCount();synchronizedCount=fusion.synchronizedCount();
    return result.fused&&result.ibiMs==760;
  }
  return false;
}

PPGSample gateSample(uint64_t timestampUs,uint32_t red=100000,uint32_t ir=100000){
  return {red,ir,(uint32_t)(timestampUs/40000ULL),timestampUs,true};
}

PpgMotionHint gateMotion(float deltaG=0,float gyro=0,bool saturated=false){
  return {deltaG,gyro,saturated,true};
}

PpgGateDecision gateUpdate(PpgValidityGate &gate,const PPGSample &sample,
                           const PpgMotionHint &motion=gateMotion()){
  return gate.update(sample,motion,fusionObservation(sample.sampleTimeUs,false),
    fusionObservation(sample.sampleTimeUs,false),PpgFusedBeat{},true,false);
}

bool runGateSelfTest(const char *name,PpgGateDecision &result){
  PpgValidityGate gate;
  gate.reset(PpgDetectorState::TRACKING);
  gateUpdate(gate,gateSample(1000000));
  if(strcmp(name,"OPTICAL_7_PERCENT")==0){
    result=gateUpdate(gate,gateSample(1040000,107000,107000));
    return result.state!=PpgDetectorState::QUARANTINED;
  }
  if(strcmp(name,"OPTICAL_9_PERCENT")==0){
    result=gateUpdate(gate,gateSample(1040000,109001,109001));
    return result.state==PpgDetectorState::QUARANTINED&&
      (result.qualityReasons&QR_OPTICAL_TRANSIENT)!=0;
  }
  if(strcmp(name,"MOTION_ONE_MODERATE")==0){
    result=gateUpdate(gate,gateSample(1040000),gateMotion(0.05f));
    return result.state!=PpgDetectorState::QUARANTINED;
  }
  if(strcmp(name,"MOTION_THREE_MODERATE")==0){
    gateUpdate(gate,gateSample(1040000),gateMotion(0.05f));
    gateUpdate(gate,gateSample(1080000),gateMotion(0.05f));
    result=gateUpdate(gate,gateSample(1120000),gateMotion(0.05f));
    return result.state==PpgDetectorState::QUARANTINED&&
      (result.qualityReasons&QR_HIGH_MOTION)!=0;
  }
  if(strcmp(name,"MOTION_SEVERE")==0){
    result=gateUpdate(gate,gateSample(1040000),gateMotion(0,0.75f));
    return result.state==PpgDetectorState::QUARANTINED&&
      (result.qualityReasons&QR_HIGH_MOTION)!=0;
  }
  if(strcmp(name,"MOTION_SATURATED")==0){
    result=gateUpdate(gate,gateSample(1040000),gateMotion(0,0,true));
    return result.state==PpgDetectorState::QUARANTINED&&
      (result.qualityReasons&QR_HIGH_MOTION)!=0;
  }
  if(strcmp(name,"RECOVERY_RESTART")==0){
    gateUpdate(gate,gateSample(1040000),gateMotion(0,0.75f));
    gateUpdate(gate,gateSample(5030000),gateMotion(0,0.75f));
    const PpgGateDecision before=gateUpdate(gate,gateSample(9020000));
    result=gateUpdate(gate,gateSample(9040000));
    return before.state==PpgDetectorState::QUARANTINED&&
      before.quarantineRemainingMs>0&&
      result.state==PpgDetectorState::CALIBRATING;
  }
  return false;
}

void runSelfTest(const char *name){
  uint16_t candidates=0,artifacts=0,normalAfter=0;
  bool passed=false;
  if(strcmp(name,"CHANNEL_WEAK")==0){
    passed=selfTestChannelWeak(candidates,artifacts);
  }else if(strcmp(name,"CHANNEL_OUTLIER")==0){
    passed=selfTestChannelOutlier(candidates,artifacts,normalAfter);
  }else if(strncmp(name,"FUSION_",7)==0){
    PpgFusedBeat result={};
    uint8_t ibiCount=0,synchronizedCount=0;
    passed=runFusionSelfTest(name,result,ibiCount,synchronizedCount);
    Serial.printf(
      "[SELFTEST] %s %s fused=%u ibi_ms=%u reset=%u ibi_count=%u sync=%u\n",
      name,passed?"PASS":"FAIL",result.fused?1u:0u,(unsigned)result.ibiMs,
      result.historyReset?1u:0u,(unsigned)ibiCount,(unsigned)synchronizedCount
    );
    return;
  }else if(strncmp(name,"OPTICAL_",8)==0||strncmp(name,"MOTION_",7)==0||
           strncmp(name,"RECOVERY_",9)==0){
    PpgGateDecision result={};
    passed=runGateSelfTest(name,result);
    Serial.printf(
      "[SELFTEST] %s %s state=%u status=%u reasons=0x%04X remaining_ms=%lu reset=%u\n",
      name,passed?"PASS":"FAIL",(unsigned)result.state,
      (unsigned)result.status,(unsigned)result.qualityReasons,
      (unsigned long)result.quarantineRemainingMs,result.resetPipeline?1u:0u
    );
    return;
  }
  Serial.printf(
    "[SELFTEST] %s %s candidate_count=%u artifact_count=%u normal_after=%u\n",
    name,passed?"PASS":"FAIL",(unsigned)candidates,(unsigned)artifacts,
    (unsigned)normalAfter
  );
}

void resetSummary(){
  accepted=rejected=validSamples=0;
  firstValidUs=validSpanStartUs=0;
  longestValidMs=0;
  bpmMin=bpmMax=NAN;
}

void observeResult(const PPGSample &sample){
  const HeartRateResult &result=PPGService::heartRateForTelemetry();
  const bool valid=result.status==HeartRateStatus::VALID &&
    result.timestampUs==sample.sampleTimeUs && isfinite(result.bpm);
  if(!valid){validSpanStartUs=0;return;}

  ++validSamples;
  if(firstValidUs==0)firstValidUs=sample.sampleTimeUs;
  if(validSpanStartUs==0)validSpanStartUs=sample.sampleTimeUs;
  const uint32_t spanMs=(uint32_t)((sample.sampleTimeUs-validSpanStartUs)/1000ULL);
  if(spanMs>longestValidMs)longestValidMs=spanMs;
  if(isnan(bpmMin)||result.bpm<bpmMin)bpmMin=result.bpm;
  if(isnan(bpmMax)||result.bpm>bpmMax)bpmMax=result.bpm;
}

void printSummary(){
  Serial.printf(
    "[REPLAY_RESULT] rows=%lu rejected=%lu fused=0 valid=%lu first_valid_us=%llu longest_valid_ms=%lu ",
    (unsigned long)accepted,(unsigned long)rejected,(unsigned long)validSamples,
    (unsigned long long)firstValidUs,(unsigned long)longestValidMs
  );
  if(validSamples==0)Serial.println(F("bpm_min=nan bpm_max=nan"));
  else Serial.printf("bpm_min=%.2f bpm_max=%.2f\n",bpmMin,bpmMax);
}

void processLine(){
  line[lineLength]='\0';
  lineLength=0;
  if(line[0]=='\0'||line[0]=='#')return;
  if(strcmp(line,"RESET")==0){
    PPGService::resetReplay();
    resetSummary();
    Serial.println(F("[REPLAY] RESET_OK"));
    return;
  }
  if(strcmp(line,"END")==0){printSummary();return;}
  constexpr const char *selfTestPrefix="SELFTEST ";
  if(strncmp(line,selfTestPrefix,strlen(selfTestPrefix))==0){
    runSelfTest(line+strlen(selfTestPrefix));
    return;
  }

  unsigned long sequence=0,red=0,ir=0;
  unsigned long long sampleUs=0;
  unsigned timing=0,saturated=0;
  float accelerationDeltaG=0,gyroMagnitudeRadS=0;
  int consumed=0;
  const int fields=sscanf(
    line,"%lu,%llu,%lu,%lu,%u,%f,%f,%u%n",
    &sequence,&sampleUs,&red,&ir,&timing,
    &accelerationDeltaG,&gyroMagnitudeRadS,&saturated,&consumed
  );
  const bool validRow=fields==8 && line[consumed]=='\0' && sequence>0 &&
    sampleUs>0 && red<=262143UL && ir<=262143UL && timing<=1 &&
    saturated<=1 && isfinite(accelerationDeltaG) &&
    isfinite(gyroMagnitudeRadS) && accelerationDeltaG>=0 &&
    gyroMagnitudeRadS>=0;
  if(!validRow){
    ++rejected;
    Serial.println(F("[REPLAY] ROW_REJECTED"));
    return;
  }

  const PpgMotionHint motion={
    accelerationDeltaG,gyroMagnitudeRadS,saturated!=0,true
  };
  const PPGSample sample={
    (uint32_t)red,(uint32_t)ir,(uint32_t)sequence,
    (uint64_t)sampleUs,timing!=0
  };
  PPGService::setMotionHint(motion);
  PPGService::processReplaySample(sample);
  ++accepted;
  observeResult(sample);
}
}
#endif

namespace BioReplay {
void begin(){
#if BIO_REPLAY_MODE
  PPGService::resetReplay();
  resetSummary();
  Serial.println(F("[REPLAY] READY schema=sequence,sample_time_us,red,ir,timing_valid,acceleration_delta_g,gyro_magnitude_rad_s,saturated"));
#endif
}

void update(){
#if BIO_REPLAY_MODE
  while(Serial.available()){
    const char character=(char)Serial.read();
    if(character=='\r')continue;
    if(character=='\n'){processLine();continue;}
    if(lineLength+1<sizeof(line))line[lineLength++]=character;
    else{lineLength=0;++rejected;}
  }
#endif
}

uint32_t acceptedRows(){
#if BIO_REPLAY_MODE
  return accepted;
#else
  return 0;
#endif
}

uint32_t rejectedRows(){
#if BIO_REPLAY_MODE
  return rejected;
#else
  return 0;
#endif
}
}
