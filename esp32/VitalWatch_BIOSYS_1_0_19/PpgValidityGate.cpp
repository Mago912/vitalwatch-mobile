#include "PpgValidityGate.h"

#include <math.h>

PpgValidityGate::PpgValidityGate(){reset();}

void PpgValidityGate::reset(PpgDetectorState state){
  state_=state;
  reasons_=state==PpgDetectorState::NO_CONTACT?QR_NO_CONTACT:
    (state==PpgDetectorState::CALIBRATING?QR_DETECTOR_CALIBRATING:QR_NONE);
  previousRed_=previousIr_=0;
  previousOpticalValid_=false;
  moderateMotionCount_=0;
  quietStartedUs_=0;
  cleanStartedUs_=0;
  lastTimestampUs_=0;
  publishedBpm_=NAN;
}

float PpgValidityGate::relativeStep(uint32_t current,uint32_t previous){
  const uint32_t difference=current>=previous?current-previous:previous-current;
  const uint32_t denominator=max(previous,PpgGateConfig::CONTACT_THRESHOLD);
  return denominator?((float)difference/(float)denominator):0.0f;
}

void PpgValidityGate::enterQuarantine(uint64_t timestampUs,uint16_t reasons){
  state_=PpgDetectorState::QUARANTINED;
  reasons_|=reasons;
  quietStartedUs_=timestampUs;
  cleanStartedUs_=0;
  publishedBpm_=NAN;
}

PpgGateDecision PpgValidityGate::decision(bool resetPipeline) const{
  PpgGateDecision result={state_,HeartRateStatus::INSUFFICIENT_DATA,NAN,reasons_,0,resetPipeline};
  switch(state_){
    case PpgDetectorState::NO_CONTACT:
      result.status=HeartRateStatus::NO_CONTACT;
      result.qualityReasons=QR_NO_CONTACT;
      break;
    case PpgDetectorState::CALIBRATING:
      result.status=HeartRateStatus::INSUFFICIENT_DATA;
      result.qualityReasons|=QR_DETECTOR_CALIBRATING;
      break;
    case PpgDetectorState::QUARANTINED:
      result.status=(reasons_&(QR_TIMING_INVALID|QR_MISSING_SAMPLES))
        ?HeartRateStatus::TIMING_INVALID:HeartRateStatus::LOW_QUALITY;
      if(lastTimestampUs_>=quietStartedUs_){
        const uint64_t elapsed=lastTimestampUs_-quietStartedUs_;
        if(elapsed<PpgGateConfig::QUARANTINE_QUIET_US)
          result.quarantineRemainingMs=(uint32_t)(
            (PpgGateConfig::QUARANTINE_QUIET_US-elapsed+999ULL)/1000ULL
          );
      }
      break;
    case PpgDetectorState::TECHNICALLY_VALID:
      result.status=HeartRateStatus::VALID;
      result.bpm=publishedBpm_;
      break;
    case PpgDetectorState::TRACKING:
      result.status=isfinite(publishedBpm_)?HeartRateStatus::UNSTABLE:
        HeartRateStatus::INSUFFICIENT_DATA;
      result.bpm=publishedBpm_;
      break;
  }
  return result;
}

PpgGateDecision PpgValidityGate::update(
    const PPGSample &sample,const PpgMotionHint &motion,
    const PpgChannelObservation &red,const PpgChannelObservation &ir,
    const PpgFusedBeat &beat,bool contact,bool missingSamples){
  lastTimestampUs_=sample.sampleTimeUs;
  if(!contact){
    reset(PpgDetectorState::NO_CONTACT);
    lastTimestampUs_=sample.sampleTimeUs;
    return decision(true);
  }

  if(state_==PpgDetectorState::NO_CONTACT){
    state_=PpgDetectorState::CALIBRATING;
    reasons_=QR_DETECTOR_CALIBRATING;
    previousOpticalValid_=false;
    cleanStartedUs_=0;
    publishedBpm_=NAN;
  }

  bool opticalArtifact=red.artifact||ir.artifact;
  if(previousOpticalValid_){
    opticalArtifact=opticalArtifact||
      relativeStep(sample.red,previousRed_)>PpgGateConfig::OPTICAL_STEP_RATIO||
      relativeStep(sample.ir,previousIr_)>PpgGateConfig::OPTICAL_STEP_RATIO;
  }
  previousRed_=sample.red;
  previousIr_=sample.ir;
  previousOpticalValid_=true;

  bool moderateMotion=false,severeMotion=false;
  if(motion.valid){
    moderateMotion=motion.accelerationDeltaG>=PpgGateConfig::MODERATE_DELTA_G||
      motion.gyroMagnitudeRadS>=PpgGateConfig::MODERATE_GYRO_RAD_S;
    severeMotion=motion.accelerationDeltaG>=PpgGateConfig::SEVERE_DELTA_G||
      motion.gyroMagnitudeRadS>=PpgGateConfig::SEVERE_GYRO_RAD_S||motion.saturated;
  }
  if(moderateMotion){
    if(moderateMotionCount_<PpgGateConfig::MODERATE_SAMPLES)++moderateMotionCount_;
  }else moderateMotionCount_=0;
  const bool sustainedMotion=moderateMotionCount_>=PpgGateConfig::MODERATE_SAMPLES;

  uint16_t artifactReasons=QR_NONE;
  if(opticalArtifact)artifactReasons|=QR_OPTICAL_TRANSIENT;
  if(severeMotion||sustainedMotion)artifactReasons|=QR_HIGH_MOTION;
  if(!sample.timingValid)artifactReasons|=QR_TIMING_INVALID;
  if(missingSamples)artifactReasons|=QR_MISSING_SAMPLES;
  const bool artifact=artifactReasons!=QR_NONE;

  if(artifact){
    const bool entering=state_!=PpgDetectorState::QUARANTINED;
    enterQuarantine(sample.sampleTimeUs,artifactReasons);
    return decision(entering);
  }

  if(state_==PpgDetectorState::QUARANTINED){
    if(sample.sampleTimeUs>=quietStartedUs_&&
       sample.sampleTimeUs-quietStartedUs_>=PpgGateConfig::QUARANTINE_QUIET_US){
      state_=PpgDetectorState::CALIBRATING;
      reasons_=QR_DETECTOR_CALIBRATING;
      moderateMotionCount_=0;
      cleanStartedUs_=0;
      publishedBpm_=NAN;
      return decision(true);
    }
    return decision();
  }

  if(state_==PpgDetectorState::CALIBRATING&&red.calibrated&&ir.calibrated){
    state_=PpgDetectorState::TRACKING;
    reasons_=QR_NONE;
    cleanStartedUs_=sample.sampleTimeUs;
  }

  if(state_==PpgDetectorState::CALIBRATING)return decision();

  reasons_=QR_NONE;
  publishedBpm_=isfinite(beat.bpm)?beat.bpm:NAN;
  const bool snrOk=red.snr>=PpgGateConfig::SNR_MIN&&
    ir.snr>=PpgGateConfig::SNR_MIN;
  if(!snrOk){
    state_=PpgDetectorState::TRACKING;
    reasons_|=QR_LOW_PULSATILITY;
    publishedBpm_=NAN;
    PpgGateDecision result=decision();
    result.status=HeartRateStatus::LOW_QUALITY;
    return result;
  }

  const bool bpmInRange=isfinite(beat.bpm)&&beat.bpm>=35.0f&&beat.bpm<=190.0f;
  const bool enoughIbis=beat.ibiCount>=PpgGateConfig::MIN_IBI_COUNT;
  const bool stableIbis=bpmInRange&&isfinite(beat.madRatio)&&
    beat.madRatio<=PpgGateConfig::MAD_RATIO_MAX&&
    beat.rangeMs<=PpgGateConfig::IBI_RANGE_MAX_MS;
  const bool synchronized=beat.synchronizationWindowSize>=PpgGateConfig::MIN_SYNCHRONIZED&&
    beat.synchronizedCount>=PpgGateConfig::MIN_SYNCHRONIZED;
  if(beat.synchronizationWindowSize>=PpgGateConfig::MIN_SYNCHRONIZED&&!synchronized)
    reasons_|=QR_CHANNEL_MISMATCH;
  if(enoughIbis&&!stableIbis)reasons_|=QR_IBI_INCONSISTENT;

  const bool cleanLongEnough=cleanStartedUs_!=0&&sample.sampleTimeUs>=cleanStartedUs_&&
    sample.sampleTimeUs-cleanStartedUs_>=PpgGateConfig::CLEAN_REQUIRED_US;
  if(enoughIbis&&stableIbis&&synchronized&&cleanLongEnough){
    state_=PpgDetectorState::TECHNICALLY_VALID;
    publishedBpm_=beat.bpm;
    return decision();
  }
  state_=PpgDetectorState::TRACKING;
  return decision();
}
