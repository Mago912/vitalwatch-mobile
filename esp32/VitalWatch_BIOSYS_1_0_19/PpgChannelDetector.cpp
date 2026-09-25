#include "PpgChannelDetector.h"

#include <math.h>
#include <string.h>

namespace {
float percentile(float *values,uint8_t count,uint8_t percentileValue){
  for(uint8_t i=0;i+1<count;++i)
    for(uint8_t j=i+1;j<count;++j)
      if(values[j]<values[i]){const float swap=values[i];values[i]=values[j];values[j]=swap;}
  const uint16_t scaled=(uint16_t)(count-1)*percentileValue;
  return values[scaled/100U];
}
}

PpgChannelDetector::PpgChannelDetector(){reset();}

void PpgChannelDetector::reset(){
  initialized_=false;
  calibrated_=false;
  calibrationSamples_=0;
  calibrationCount_=0;
  calibrationPosition_=0;
  memset(calibration_,0,sizeof(calibration_));
  memset(raw_,0,sizeof(raw_));rawCount_=rawPosition_=0;
  filtered_=previous1_=previous2_=valley_=0;
  previousTimestampUs_=0;
  noise_=0.5f;
  signal_=1.5f;
  memset(fusedProminences_,0,sizeof(fusedProminences_));
  fusedCount_=fusedPosition_=0;
  memset(pendingTimes_,0,sizeof(pendingTimes_));
  memset(pendingProminences_,0,sizeof(pendingProminences_));
  memset(pendingSuppressed_,0,sizeof(pendingSuppressed_));
  pendingCount_=0;
}

void PpgChannelDetector::finishCalibration(){
  float sorted[PpgChannelConfig::PROMINENCE_CAPACITY];
  memcpy(sorted,calibration_,sizeof(sorted));
  noise_=max(0.5f,percentile(sorted,calibrationCount_,25));
  memcpy(sorted,calibration_,sizeof(sorted));
  signal_=max(noise_+1.0f,percentile(sorted,calibrationCount_,90));
  calibrated_=true;
  valley_=filtered_;
}

float PpgChannelDetector::threshold() const{
  return max(0.75f,noise_+PpgChannelConfig::THRESHOLD_FRACTION*
    max(0.0f,signal_-noise_));
}

float PpgChannelDetector::medianFusedProminence() const{
  if(fusedCount_==0)return 0;
  float sorted[PpgChannelConfig::PROMINENCE_CAPACITY];
  for(uint8_t i=0;i<fusedCount_;++i)sorted[i]=fusedProminences_[i];
  for(uint8_t i=0;i+1<fusedCount_;++i)
    for(uint8_t j=i+1;j<fusedCount_;++j)
      if(sorted[j]<sorted[i]){const float swap=sorted[i];sorted[i]=sorted[j];sorted[j]=swap;}
  return sorted[fusedCount_/2];
}

float PpgChannelDetector::filteredSample() const{
  if(rawCount_<PpgChannelConfig::FIR_LONG_SAMPLES)return 0;
  uint64_t longSum=0,shortSum=0;
  for(uint8_t offset=0;offset<PpgChannelConfig::FIR_LONG_SAMPLES;++offset){
    const uint8_t index=(rawPosition_+PpgChannelConfig::FIR_LONG_SAMPLES-1-offset)%
      PpgChannelConfig::FIR_LONG_SAMPLES;
    longSum+=raw_[index];
    if(offset<PpgChannelConfig::FIR_SHORT_SAMPLES)shortSum+=raw_[index];
  }
  return (float)shortSum/PpgChannelConfig::FIR_SHORT_SAMPLES-
    (float)longSum/PpgChannelConfig::FIR_LONG_SAMPLES;
}

void PpgChannelDetector::addPendingMaximum(uint64_t timestampUs,float prominence){
  if(pendingCount_>=PpgChannelConfig::NMS_CAPACITY)return;
  bool suppressed=false;
  for(uint8_t index=0;index<pendingCount_;++index){
    if(timestampUs-pendingTimes_[index]>PpgChannelConfig::NMS_RADIUS_US)continue;
    if(prominence>pendingProminences_[index])pendingSuppressed_[index]=true;
    else suppressed=true;
  }
  pendingTimes_[pendingCount_]=timestampUs;
  pendingProminences_[pendingCount_]=prominence;
  pendingSuppressed_[pendingCount_]=suppressed;
  ++pendingCount_;
}

bool PpgChannelDetector::emitMaturedMaximum(
    uint64_t observedAtUs,PpgChannelObservation &observation){
  if(pendingCount_==0||observedAtUs<pendingTimes_[0]||
     observedAtUs-pendingTimes_[0]<PpgChannelConfig::NMS_RADIUS_US)return false;
  const bool emit=!pendingSuppressed_[0];
  if(emit){
    observation.timestampUs=pendingTimes_[0];
    observation.prominence=pendingProminences_[0];
    observation.candidate=true;
  }
  for(uint8_t index=1;index<pendingCount_;++index){
    pendingTimes_[index-1]=pendingTimes_[index];
    pendingProminences_[index-1]=pendingProminences_[index];
    pendingSuppressed_[index-1]=pendingSuppressed_[index];
  }
  --pendingCount_;
  return emit;
}

PpgChannelObservation PpgChannelDetector::update(uint32_t raw,uint64_t timestampUs){
  PpgChannelObservation observation={timestampUs,timestampUs,0,0,threshold(),
    signalToNoise(),false,false,false};
  emitMaturedMaximum(timestampUs,observation);
  raw_[rawPosition_]=raw;
  rawPosition_=(rawPosition_+1)%PpgChannelConfig::FIR_LONG_SAMPLES;
  if(rawCount_<PpgChannelConfig::FIR_LONG_SAMPLES)++rawCount_;
  ++calibrationSamples_;
  if(rawCount_<PpgChannelConfig::FIR_LONG_SAMPLES){
    previousTimestampUs_=timestampUs;
    return observation;
  }
  initialized_=true;
  filtered_=filteredSample();

  if(filtered_<valley_)valley_=filtered_;
  const bool localMaximum=previous1_>previous2_ && previous1_>=filtered_;
  const float localProminence=localMaximum?max(0.0f,previous1_-valley_):0.0f;

  if(!calibrated_){
    if(localMaximum&&localProminence>0){
      calibration_[calibrationPosition_]=localProminence;
      calibrationPosition_=(calibrationPosition_+1)%PpgChannelConfig::PROMINENCE_CAPACITY;
      if(calibrationCount_<PpgChannelConfig::PROMINENCE_CAPACITY)++calibrationCount_;
      valley_=filtered_;
    }
    if(calibrationSamples_>=PpgChannelConfig::CALIBRATION_SAMPLES&&
       calibrationCount_>=4)finishCalibration();
    previous2_=previous1_;
    previous1_=filtered_;
    previousTimestampUs_=timestampUs;
    observation.filtered=filtered_;
    observation.threshold=threshold();
    observation.snr=signalToNoise();
    observation.calibrated=calibrated_;
    return observation;
  }

  if(localMaximum){
    const uint64_t peakTimestampUs=previousTimestampUs_;
    const float fusedMedian=medianFusedProminence();
    observation.artifact=fusedCount_>=4 && fusedMedian>0 &&
      localProminence>6.0f*fusedMedian;
    const bool eligible=!observation.artifact&&localProminence>=threshold();
    if(eligible)addPendingMaximum(peakTimestampUs,localProminence);
    if(!eligible&&!observation.artifact){
      const float bounded=min(localProminence,threshold());
      noise_+=PpgChannelConfig::NOISE_ALPHA*(bounded-noise_);
    }
    valley_=filtered_;
  }

  previous2_=previous1_;
  previous1_=filtered_;
  previousTimestampUs_=timestampUs;
  observation.filtered=filtered_;
  observation.threshold=threshold();
  observation.snr=signalToNoise();
  observation.calibrated=true;
  return observation;
}

void PpgChannelDetector::confirmFused(float prominence){
  if(!calibrated_||!isfinite(prominence)||prominence<=0)return;
  signal_+=PpgChannelConfig::SIGNAL_ALPHA*(prominence-signal_);
  fusedProminences_[fusedPosition_]=prominence;
  fusedPosition_=(fusedPosition_+1)%PpgChannelConfig::PROMINENCE_CAPACITY;
  if(fusedCount_<PpgChannelConfig::PROMINENCE_CAPACITY)++fusedCount_;
}

float PpgChannelDetector::signalToNoise() const{
  return signal_/max(0.001f,noise_);
}
