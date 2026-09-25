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
  calibrationCount_=0;
  memset(calibration_,0,sizeof(calibration_));
  dc_=filtered_=previous1_=previous2_=valley_=0;
  previousTimestampUs_=0;
  noise_=0.5f;
  signal_=1.5f;
  memset(fusedProminences_,0,sizeof(fusedProminences_));
  fusedCount_=fusedPosition_=0;
}

void PpgChannelDetector::finishCalibration(){
  float sorted[PpgChannelConfig::CALIBRATION_SAMPLES];
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

PpgChannelObservation PpgChannelDetector::update(uint32_t raw,uint64_t timestampUs){
  PpgChannelObservation observation={timestampUs,0,0,threshold(),signalToNoise(),false,false,false};
  if(!initialized_){
    initialized_=true;
    dc_=(float)raw;
    previousTimestampUs_=timestampUs;
    calibration_[calibrationCount_++]=0;
    return observation;
  }

  dc_+=PpgChannelConfig::DC_ALPHA*((float)raw-dc_);
  const float ac=(float)raw-dc_;
  filtered_+=PpgChannelConfig::FILTER_ALPHA*(ac-filtered_);

  if(!calibrated_){
    calibration_[calibrationCount_++]=fabsf(filtered_);
    previous2_=previous1_;
    previous1_=filtered_;
    previousTimestampUs_=timestampUs;
    if(calibrationCount_>=PpgChannelConfig::CALIBRATION_SAMPLES)finishCalibration();
    observation.filtered=filtered_;
    observation.threshold=threshold();
    observation.snr=signalToNoise();
    observation.calibrated=calibrated_;
    return observation;
  }

  if(filtered_<valley_)valley_=filtered_;
  const bool localMaximum=previous1_>previous2_ && previous1_>=filtered_;
  if(localMaximum){
    observation.timestampUs=previousTimestampUs_;
    observation.prominence=max(0.0f,previous1_-valley_);
    const float fusedMedian=medianFusedProminence();
    observation.artifact=fusedCount_>=4 && fusedMedian>0 &&
      observation.prominence>6.0f*fusedMedian;
    observation.candidate=!observation.artifact &&
      observation.prominence>=threshold();
    if(!observation.candidate&&!observation.artifact){
      const float bounded=min(observation.prominence,threshold());
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
