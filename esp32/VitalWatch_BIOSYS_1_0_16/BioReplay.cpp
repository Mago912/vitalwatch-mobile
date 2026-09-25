#include "BioReplay.h"
#include "Configuracion.h"
#include "Sensor_Oxigeno.h"

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
