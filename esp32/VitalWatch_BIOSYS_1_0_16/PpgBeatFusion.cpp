#include "PpgBeatFusion.h"

#include <math.h>
#include <string.h>

PpgBeatFusion::PpgBeatFusion(){reset();}

void PpgBeatFusion::reset(){
  pendingRed_=pendingIr_=false;
  red_={};
  ir_={};
  redObservedAtUs_=irObservedAtUs_=0;
  lastFusedUs_=0;
  memset(ibis_,0,sizeof(ibis_));
  ibiCount_=ibiPosition_=0;
  memset(synchronized_,0,sizeof(synchronized_));
  synchronizedSize_=synchronizedPosition_=0;
}

uint64_t PpgBeatFusion::absoluteDifference(uint64_t left,uint64_t right){
  return left>=right?left-right:right-left;
}

void PpgBeatFusion::recordSynchronization(bool synchronized){
  synchronized_[synchronizedPosition_]=synchronized;
  synchronizedPosition_=(synchronizedPosition_+1)%PpgFusionConfig::IBI_CAPACITY;
  if(synchronizedSize_<PpgFusionConfig::IBI_CAPACITY)++synchronizedSize_;
}

PpgFusedBeat PpgBeatFusion::acceptPair(){
  const uint64_t difference=absoluteDifference(red_.timestampUs,ir_.timestampUs);
  const uint64_t timestamp=min(red_.timestampUs,ir_.timestampUs)+difference/2ULL;
  PpgFusedBeat result={timestamp,0,red_.prominence,ir_.prominence,true,false};
  pendingRed_=pendingIr_=false;

  if(lastFusedUs_==0){lastFusedUs_=timestamp;recordSynchronization(true);return resultWithMetrics(result);}
  const uint64_t deltaUs=timestamp-lastFusedUs_;
  const uint32_t ibiMs=(uint32_t)(deltaUs/1000ULL);
  if(ibiMs<PpgFusionConfig::IBI_MIN_MS){
    result.fused=false;
    recordSynchronization(false);
    return resultWithMetrics(result);
  }
  lastFusedUs_=timestamp;
  if(ibiMs>PpgFusionConfig::IBI_MAX_MS){
    memset(ibis_,0,sizeof(ibis_));
    ibiCount_=ibiPosition_=0;
    memset(synchronized_,0,sizeof(synchronized_));
    synchronizedSize_=synchronizedPosition_=0;
    recordSynchronization(true);
    result.historyReset=true;
    return resultWithMetrics(result);
  }

  result.ibiMs=(uint16_t)ibiMs;
  ibis_[ibiPosition_]=result.ibiMs;
  ibiPosition_=(ibiPosition_+1)%PpgFusionConfig::IBI_CAPACITY;
  if(ibiCount_<PpgFusionConfig::IBI_CAPACITY)++ibiCount_;
  recordSynchronization(true);
  return resultWithMetrics(result);
}

PpgFusedBeat PpgBeatFusion::resultWithMetrics(const PpgFusedBeat &source) const{
  PpgFusedBeat result=source;
  result.ibiCount=ibiCount_;
  result.synchronizedCount=synchronizedCount();
  result.synchronizationWindowSize=synchronizedSize_;
  if(!robustBpm(result.bpm,result.madRatio,result.rangeMs)){
    result.bpm=NAN;
    result.madRatio=NAN;
    result.rangeMs=0;
  }
  return result;
}

PpgFusedBeat PpgBeatFusion::update(const PpgChannelObservation &red,
                                   const PpgChannelObservation &ir){
  PpgFusedBeat result={0,0,0,0,false,false};
  const uint64_t now=max(red.observedAtUs,ir.observedAtUs);
  if(pendingRed_&&now>redObservedAtUs_&&
     now-redObservedAtUs_>PpgFusionConfig::MATCH_WINDOW_US){
    pendingRed_=false;
    recordSynchronization(false);
  }
  if(pendingIr_&&now>irObservedAtUs_&&
     now-irObservedAtUs_>PpgFusionConfig::MATCH_WINDOW_US){
    pendingIr_=false;
    recordSynchronization(false);
  }
  if(red.candidate&&!red.artifact){red_=red;redObservedAtUs_=now;pendingRed_=true;}
  if(ir.candidate&&!ir.artifact){ir_=ir;irObservedAtUs_=now;pendingIr_=true;}
  if(!pendingRed_||!pendingIr_)return resultWithMetrics(result);

  const uint64_t difference=absoluteDifference(red_.timestampUs,ir_.timestampUs);
  if(difference<=PpgFusionConfig::MATCH_WINDOW_US)return acceptPair();
  if(red_.timestampUs<ir_.timestampUs)pendingRed_=false;
  else pendingIr_=false;
  recordSynchronization(false);
  return resultWithMetrics(result);
}

uint8_t PpgBeatFusion::ibiCount() const{return ibiCount_;}

uint8_t PpgBeatFusion::synchronizedCount() const{
  uint8_t count=0;
  for(uint8_t index=0;index<synchronizedSize_;++index)
    if(synchronized_[index])++count;
  return count;
}

bool PpgBeatFusion::robustBpm(float &bpm,float &madRatio,uint16_t &rangeMs) const{
  bpm=NAN;
  madRatio=NAN;
  rangeMs=0;
  if(ibiCount_==0)return false;
  uint16_t sorted[PpgFusionConfig::IBI_CAPACITY];
  for(uint8_t index=0;index<ibiCount_;++index)sorted[index]=ibis_[index];
  for(uint8_t i=0;i+1<ibiCount_;++i)
    for(uint8_t j=i+1;j<ibiCount_;++j)
      if(sorted[j]<sorted[i]){const uint16_t swap=sorted[i];sorted[i]=sorted[j];sorted[j]=swap;}
  const uint16_t median=sorted[ibiCount_/2];
  if(median==0)return false;
  uint16_t deviations[PpgFusionConfig::IBI_CAPACITY];
  for(uint8_t index=0;index<ibiCount_;++index)
    deviations[index]=sorted[index]>median?sorted[index]-median:median-sorted[index];
  for(uint8_t i=0;i+1<ibiCount_;++i)
    for(uint8_t j=i+1;j<ibiCount_;++j)
      if(deviations[j]<deviations[i]){
        const uint16_t swap=deviations[i];deviations[i]=deviations[j];deviations[j]=swap;
      }
  bpm=60000.0f/(float)median;
  madRatio=(float)deviations[ibiCount_/2]/(float)median;
  rangeMs=sorted[ibiCount_-1]-sorted[0];
  return true;
}
