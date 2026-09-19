#include "Sensor_Oxigeno.h"
#include <Wire.h>
#include <math.h>
#include <string.h>
#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"
#include "I2CBusService.h"
#include "SystemState.h"
#include "BioResearch.h"
#include "MonotonicMicros.h"

namespace PPGConfig {
// [BIOSYS-H1] Adquisición estable para el MAX30102 y ventanas PPG.
constexpr uint8_t ADDRESS=0x57;
// BASELINE MAX30102: conservar hasta dataset.
// La prueba física de 1.0.2 saturó inicialmente con 0x70. Se empieza más bajo
// y la autoganancia conserva margen para subir si la señal es insuficiente.
constexpr uint8_t LED_INITIAL=0x50, LED_MIN=0x35, LED_MAX=0xC0, LED_STEP=0x10;
constexpr uint8_t FIFO_AVG=4, LED_MODE=2;
// A 100 Hz/AVG4 el FIFO entrega ~25 registros/s, igual a la frecuencia que
// espera el algoritmo MAXIM tras decimación, pero con mucha menos probabilidad
// de desbordar el buffer circular de 4 muestras de SparkFun.
constexpr uint16_t SENSOR_RATE=100, PULSE_WIDTH_US=411, ADC_RANGE=4096;
constexpr uint32_t EFFECTIVE_RATE_HZ=25; // 100 / AVG4
constexpr uint32_t SAMPLE_PERIOD_US=1000000UL/EFFECTIVE_RATE_HZ;
constexpr uint8_t HARDWARE_FIFO_CAPACITY=32;

constexpr uint32_t CONTACT_THRESHOLD=14000UL, REMOVE_THRESHOLD=8500UL, AUTOGAIN_START=7000UL;
constexpr uint32_t IR_TARGET_MIN=38000UL, IR_TARGET_MAX=90000UL;
// 12 samples @ 100Hz del baseline, ahora expresados semanticamente como tiempo.
constexpr uint32_t CONTACT_CONFIRM_US=120000UL;
constexpr uint32_t CONTACT_LOST_CONFIRM_US=120000UL;
constexpr uint32_t STABILIZE_MS=4000UL, SESSION_TIMEOUT_MS=45000UL, AUTOGAIN_MS=450UL;

constexpr uint16_t IBI_MIN_MS=330, IBI_MAX_MS=1600; // no retunear aun
constexpr uint8_t IBI_COUNT=8;
constexpr int32_t SPO2_N=100, SPO2_NEW=25;
// El FIFO ya queda en 25 Hz; no se descartan 3 de cada 4 muestras antes de
// llenar la ventana MAXIM de 100 puntos (~4 s).
constexpr uint8_t SPO2_DECIMATION=1, SPO2_HISTORY=5;
constexpr uint8_t MAX_VISIBLE_SAMPLES_PER_UPDATE=4; // SparkFun STORAGE_SIZE=4; capacidad efectiva circular <=3.
constexpr uint8_t DISPLAY_HISTORY=5;
}

namespace {
// [BIOSYS-G2] Estado privado de sesión, resultados independientes y diagnósticos.
MAX30105 sensor;
HeartRateResult hr={NAN,HeartRateStatus::NO_CONTACT,SignalQuality::NO_SIGNAL,QR_NO_CONTACT,0,VitalWatchConfig::ALGORITHM_VERSION_HR};
SpO2Result sp={NAN,SpO2Status::NO_CONTACT,SignalQuality::NO_SIGNAL,QR_NO_CONTACT,0,VitalWatchConfig::ALGORITHM_VERSION_SPO2,VitalWatchConfig::CALIBRATION_VERSION_SPO2};
// Resultados publicados para la TFT y la telemetria. Los algoritmos internos
// siguen trabajando muestra a muestra, pero la salida se actualiza cada 5 s
// usando la mediana de las ultimas estimaciones distintas.
HeartRateResult hrDisplay=hr;
SpO2Result spDisplay=sp;
float displayBpmHistory[PPGConfig::DISPLAY_HISTORY]={NAN};
uint8_t displayBpmCount=0, displayBpmPos=0;
float lastQueuedBpm=NAN;
uint64_t lastQueuedBpmUs=0;
uint32_t lastDisplayPublishMs=0;
MeasurementSessionState session=MeasurementSessionState::WAITING_CONTACT;
PPGDiagnostics diag={};
PPGSample latest={0,0,0,0,0,PPGTimestampSource::ESTIMATED_PERIODIC,false,false};

uint32_t sequence=0;
uint32_t sessionCounter=0;
uint16_t missingSamplesRemaining=0;
uint64_t lastServiceUs=0;
uint64_t lastEstimatedSampleUs=0;
uint32_t lastTimestampSequence=0;
uint32_t lastSoftwareOverflow=0;
uint32_t lastShortRead=0;
uint32_t lastHardwareOverflowTotal=0;
uint64_t contactCandidateUs=0, noContactCandidateUs=0;
bool contact=false, stabilizing=false;
bool alignFifoOnFirstService=true;
uint32_t stabilizingStartedMs=0, measuringStartedMs=0, lastAutogainMs=0;
uint32_t irSmooth=0;

uint16_t ibis[PPGConfig::IBI_COUNT]={0}; uint8_t ibiCount=0, ibiPos=0;
uint64_t lastAcceptedPeakUs=0, lastCustomPeakUs=0, lastSparkPeakUs=0;
uint16_t lastIbiMs=0; float bpmInstant=0;
float dcIR=0, filtered=0, prev1=0, prev2=0, valley=0, envelope=0, pulseAmpEma=0, lastPulseAmp=0;

uint32_t irBuf[PPGConfig::SPO2_N]={0}, redBuf[PPGConfig::SPO2_N]={0};
int32_t bufCount=0,newCount=0; uint8_t decim=0; bool bufferFull=false;
int32_t maximSpO2=0,maximHR=0; int8_t maximSpO2Valid=0,maximHRValid=0;
int spo2Hist[PPGConfig::SPO2_HISTORY]={0};uint8_t spo2Count=0,spo2Pos=0;
uint8_t led=PPGConfig::LED_INITIAL;
bool qualityAcceptable=false,qualityGood=false;
uint16_t currentReasons=QR_NONE;

void setError(const char*t){snprintf(diag.error,sizeof(diag.error),"%s",t);}

void clearDisplayBpmHistory(){
  for(uint8_t i=0;i<PPGConfig::DISPLAY_HISTORY;++i)displayBpmHistory[i]=NAN;
  displayBpmCount=displayBpmPos=0;lastQueuedBpm=NAN;lastQueuedBpmUs=0;
}

void resetDisplayResults(){
  hrDisplay=hr;spDisplay=sp;
  clearDisplayBpmHistory();
  lastDisplayPublishMs=millis();
}

float medianDisplayedBpm(){
  if(!displayBpmCount)return NAN;
  float a[PPGConfig::DISPLAY_HISTORY];
  for(uint8_t i=0;i<displayBpmCount;++i)a[i]=displayBpmHistory[i];
  for(uint8_t i=0;i+1<displayBpmCount;++i)
    for(uint8_t j=i+1;j<displayBpmCount;++j)
      if(a[j]<a[i]){float t=a[i];a[i]=a[j];a[j]=t;}
  return a[displayBpmCount/2];
}

void queueDisplayBpm(){
  if(isnan(hr.bpm) ||
     (hr.status!=HeartRateStatus::VALID && hr.status!=HeartRateStatus::UNSTABLE))return;
  const uint64_t timestamp=hr.timestampUs;
  const bool changed=isnan(lastQueuedBpm)||fabsf(hr.bpm-lastQueuedBpm)>=0.5f;
  const bool aged=lastQueuedBpmUs==0||(timestamp-lastQueuedBpmUs)>=200000ULL;
  if(!changed&&!aged)return;
  displayBpmHistory[displayBpmPos]=hr.bpm;
  displayBpmPos=(displayBpmPos+1)%PPGConfig::DISPLAY_HISTORY;
  if(displayBpmCount<PPGConfig::DISPLAY_HISTORY)++displayBpmCount;
  lastQueuedBpm=hr.bpm;lastQueuedBpmUs=timestamp;
}

void publishDisplayResults(){
  const bool hrUsable=!isnan(hr.bpm)&&
    (hr.status==HeartRateStatus::VALID||hr.status==HeartRateStatus::UNSTABLE);

  // Una medicion invalida debe reemplazar el resultado retenido de inmediato.
  // Asi la TFT y la telemetria no siguen exponiendo una fotografia anterior.
  if(!hrUsable){hrDisplay=hr;clearDisplayBpmHistory();}
  else queueDisplayBpm();
  if(sp.status!=SpO2Status::EXPERIMENTAL_VALID||isnan(sp.spo2Estimate))spDisplay=sp;

  const uint32_t now=millis();
  if(now-lastDisplayPublishMs<VitalWatchConfig::INTERVALO_RESULTADO_PPG_MS)return;
  lastDisplayPublishMs=now;

  if(hrUsable&&displayBpmCount>=3){
    const float median=medianDisplayedBpm();
    const HeartRateStatus status=hr.status==HeartRateStatus::VALID
      ?HeartRateStatus::VALID:HeartRateStatus::UNSTABLE;
    hrDisplay={median,status,hr.quality,hr.qualityReasons,hr.timestampUs,hr.algorithmVersion};
  }else{
    hrDisplay=hr;
  }

  spDisplay=sp;
}

void resetAlgorithms(bool preserveResults=true){
  memset(ibis,0,sizeof(ibis));ibiCount=ibiPos=0;lastAcceptedPeakUs=lastCustomPeakUs=lastSparkPeakUs=0;lastIbiMs=0;bpmInstant=0;
  dcIR=filtered=prev1=prev2=valley=envelope=pulseAmpEma=lastPulseAmp=0;
  memset(irBuf,0,sizeof(irBuf));memset(redBuf,0,sizeof(redBuf));bufCount=newCount=0;decim=0;bufferFull=false;
  memset(spo2Hist,0,sizeof(spo2Hist));spo2Count=spo2Pos=0;
  maximSpO2=maximHR=0;maximSpO2Valid=maximHRValid=0;
  diag.modulationIndexIR=diag.modulationIndexRed=diag.ratioR=0;diag.maximSpo2=0;diag.maximSpo2Valid=0;diag.maximHeartRate=0;diag.maximHeartRateValid=0;diag.researchSpo2Candidate=NAN;
  missingSamplesRemaining=0;diag.missingSamplesInWindow=false;qualityAcceptable=qualityGood=false;currentReasons=QR_NONE;
  if(!preserveResults){
    hr={NAN,HeartRateStatus::INSUFFICIENT_DATA,SignalQuality::POOR,QR_NONE,0,VitalWatchConfig::ALGORITHM_VERSION_HR};
    sp={NAN,SpO2Status::INSUFFICIENT_DATA,SignalQuality::POOR,QR_NONE,0,VitalWatchConfig::ALGORITHM_VERSION_SPO2,VitalWatchConfig::CALIBRATION_VERSION_SPO2};
  }
}

uint16_t medianIbi(){
  if(!ibiCount)return 0;uint16_t a[PPGConfig::IBI_COUNT];for(uint8_t i=0;i<ibiCount;++i)a[i]=ibis[i];
  for(uint8_t i=0;i+1<ibiCount;++i)for(uint8_t j=i+1;j<ibiCount;++j)if(a[j]<a[i]){uint16_t t=a[i];a[i]=a[j];a[j]=t;}
  return a[ibiCount/2];
}

bool robustBpm(float &out,bool &unstable){
  out=NAN;unstable=false;
  if(ibiCount<4)return false; const uint16_t med=medianIbi();if(!med)return false;
  uint32_t sumDiff=0;uint16_t mn=65535,mx=0;
  for(uint8_t i=0;i<ibiCount;++i){uint16_t v=ibis[i];mn=min(mn,v);mx=max(mx,v);sumDiff+=(v>med?v-med:med-v);}
  const float variation=100.0f*(sumDiff/(float)ibiCount)/med; const float bpm=60000.0f/med;
  const bool consistent=variation<=18.0f&&(mx-mn)<=260; const bool range=bpm>=35&&bpm<=190;
  unstable=!consistent; if(!consistent||!range)return false;out=bpm;return true;
}

// [BIOSYS-H2] Fallback visual prudente: conserva el BPM mediano cuando hay
// al menos tres intervalos y una señal ópticamente aceptable, aunque todavía
// no cumpla la estabilidad estricta. Se marca como INESTABLE/APROX y nunca se
// publica como frecuencia válida en la telemetría.
bool approximateBpm(float &out){
  out=NAN;
  if(ibiCount<3)return false;
  const uint16_t med=medianIbi();
  if(!med)return false;
  uint32_t sumDiff=0;uint16_t mn=65535,mx=0;
  for(uint8_t i=0;i<ibiCount;++i){uint16_t v=ibis[i];mn=min(mn,v);mx=max(mx,v);sumDiff+=(v>med?v-med:med-v);}
  const float variation=100.0f*(sumDiff/(float)ibiCount)/med;
  const float bpm=60000.0f/med;
  if(variation>35.0f||(mx-mn)>500||bpm<40.0f||bpm>180.0f)return false;
  out=bpm;return true;
}

bool acceptPeak(uint64_t sampleUs,float amplitude){
  if(lastAcceptedPeakUs){
    const uint32_t ibi=(uint32_t)((sampleUs-lastAcceptedPeakUs)/1000ULL);
    if(ibi<PPGConfig::IBI_MIN_MS)return false;
    if(ibi<=PPGConfig::IBI_MAX_MS){
      lastIbiMs=(uint16_t)ibi;ibis[ibiPos]=lastIbiMs;ibiPos=(ibiPos+1)%PPGConfig::IBI_COUNT;if(ibiCount<PPGConfig::IBI_COUNT)++ibiCount;
      bpmInstant=60000.0f/ibi;
    }else{ibiCount=ibiPos=0;bpmInstant=0;lastIbiMs=0;}
  }
  lastAcceptedPeakUs=sampleUs;
  pulseAmpEma=(pulseAmpEma<=0)?amplitude:pulseAmpEma*0.80f+amplitude*0.20f;
  return true;
}

uint8_t processPeaks(const PPGSample&s,float &acOut){
  // [BIOSYS-G3] Detección dual de picos y aceptación temporal/amplitudinal.
  uint8_t bits=PEAK_NONE;
  if(dcIR==0){dcIR=(float)s.ir;valley=0;acOut=0;return bits;}
  dcIR+=0.010f*((float)s.ir-dcIR); const float ac=(float)s.ir-dcIR;acOut=ac;filtered+=0.22f*(ac-filtered);
  envelope*=0.995f;const float absf=fabsf(filtered);if(absf>envelope)envelope=absf;if(filtered<valley)valley=filtered;
  const bool localMax=prev1>prev2&&prev1>=filtered;
  bool custom=false;
  if(localMax){
    const float amp=prev1-valley;lastPulseAmp=amp;const float th=(pulseAmpEma>0)?max(25.0f,pulseAmpEma*0.38f):max(25.0f,envelope*0.22f);
    const bool refractory=!lastCustomPeakUs||((s.sampleTimeUs-lastCustomPeakUs)/1000ULL)>=PPGConfig::IBI_MIN_MS;
    custom=refractory&&prev1>8.0f&&amp>=th&&amp<=15000.0f;
    if(custom){bits|=PEAK_CUSTOM;lastCustomPeakUs=s.sampleTimeUs;}
    valley=filtered;
  }
  const bool spark=checkForBeat((int32_t)s.ir);
  if(spark){bits|=PEAK_SPARKFUN;lastSparkPeakUs=s.sampleTimeUs;}

  // Los dos detectores permanecen observables. El aceptador es comun y aplica
  // el mismo periodo refractario usando TIEMPO DE MUESTRA, no tiempo de CPU.
  if(custom||spark){
    const uint32_t sinceMs=lastAcceptedPeakUs?(uint32_t)((s.sampleTimeUs-lastAcceptedPeakUs)/1000ULL):UINT32_MAX;
    if(!lastAcceptedPeakUs||sinceMs>=PPGConfig::IBI_MIN_MS){if(acceptPeak(s.sampleTimeUs,max(30.0f,lastPulseAmp)))bits|=PEAK_ACCEPTED;}
  }
  prev2=prev1;prev1=filtered;return bits;
}

void addSpO2(int v){spo2Hist[spo2Pos]=v;spo2Pos=(spo2Pos+1)%PPGConfig::SPO2_HISTORY;if(spo2Count<PPGConfig::SPO2_HISTORY)++spo2Count;}
int medianSpO2(){if(!spo2Count)return 0;int a[PPGConfig::SPO2_HISTORY];for(uint8_t i=0;i<spo2Count;++i)a[i]=spo2Hist[i];for(uint8_t i=0;i+1<spo2Count;++i)for(uint8_t j=i+1;j<spo2Count;++j)if(a[j]<a[i]){int t=a[i];a[i]=a[j];a[j]=t;}return a[spo2Count/2];}
bool stableSpO2(float&out){out=NAN;if(spo2Count<4)return false;int mn=101,mx=0;for(uint8_t i=0;i<spo2Count;++i){mn=min(mn,spo2Hist[i]);mx=max(mx,spo2Hist[i]);}if(mx-mn>4)return false;const int m=medianSpO2();if(m<85||m>100)return false;out=(float)m;return true;}

SignalQuality evaluateQuality(){
  // [BIOSYS-G4] Calidad explicable: razones acumulables, no solo válido/inválido.
  currentReasons=QR_NONE;
  if(!contact){currentReasons|=QR_NO_CONTACT;qualityAcceptable=qualityGood=false;return SignalQuality::NO_SIGNAL;}
  if(!bufferFull){qualityAcceptable=qualityGood=false;return SignalQuality::POOR;}

  double sumI=0,sumR=0;uint32_t maxI=0,maxR=0;
  for(int32_t i=0;i<PPGConfig::SPO2_N;++i){sumI+=irBuf[i];sumR+=redBuf[i];maxI=max(maxI,irBuf[i]);maxR=max(maxR,redBuf[i]);}
  const float meanI=sumI/PPGConfig::SPO2_N,meanR=sumR/PPGConfig::SPO2_N;if(meanI<=0||meanR<=0){currentReasons|=QR_LOW_PULSATILITY;return SignalQuality::INVALID;}
  double sqI=0,sqR=0;for(int32_t i=0;i<PPGConfig::SPO2_N;++i){float di=irBuf[i]-meanI,dr=redBuf[i]-meanR;sqI+=(double)di*di;sqR+=(double)dr*dr;}
  const float rmsI=sqrtf((float)(sqI/PPGConfig::SPO2_N)),rmsR=sqrtf((float)(sqR/PPGConfig::SPO2_N));
  diag.modulationIndexIR=100.0f*rmsI/meanI;diag.modulationIndexRed=100.0f*rmsR/meanR;
  diag.ratioR=(rmsI>0&&meanR>0)?(rmsR/meanR)/(rmsI/meanI):0;
  const bool sat=maxI>=250000UL||maxR>=250000UL;if(sat)currentReasons|=QR_SATURATED;
  const bool dcOk=meanI>=PPGConfig::CONTACT_THRESHOLD&&meanR>=5000.0f;
  const bool modOk=diag.modulationIndexIR>=0.06f&&diag.modulationIndexIR<=12.0f&&diag.modulationIndexRed>=0.04f&&diag.modulationIndexRed<=12.0f;
  if(!modOk)currentReasons|=QR_LOW_PULSATILITY;
  if(diag.missingSamplesInWindow)currentReasons|=QR_MISSING_SAMPLES;
  qualityAcceptable=dcOk&&!sat&&modOk&&!diag.missingSamplesInWindow;
  qualityGood=qualityAcceptable&&diag.modulationIndexIR>=0.15f&&diag.modulationIndexRed>=0.10f&&ibiCount>=3;
  return qualityGood?SignalQuality::GOOD:(qualityAcceptable?SignalQuality::FAIR:SignalQuality::POOR);
}

void calculateMaxim(){
  // [BIOSYS-G5] Estimación experimental SpO2/HR con el algoritmo MAXIM.
  const SignalQuality q=evaluateQuality();
  maxim_heart_rate_and_oxygen_saturation(irBuf,PPGConfig::SPO2_N,redBuf,&maximSpO2,&maximSpO2Valid,&maximHR,&maximHRValid);
  diag.maximSpo2=maximSpO2;diag.maximSpo2Valid=maximSpO2Valid;diag.maximHeartRate=maximHR;diag.maximHeartRateValid=maximHRValid;

  // RESEARCH ONLY. NO constrain(), NO result path.
  diag.researchSpo2Candidate=(diag.ratioR>=0.35f&&diag.ratioR<=1.35f)?(110.0f-25.0f*diag.ratioR):NAN;

  // Cambio obligatorio: MaximValid AND VitalWatchQuality.
  if(maximSpO2Valid && qualityAcceptable && maximSpO2>=80 && maximSpO2<=100)addSpO2((int)maximSpO2);

  float stable=NAN;
  if(stableSpO2(stable)) sp={stable,SpO2Status::EXPERIMENTAL_VALID,q,currentReasons,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_SPO2,VitalWatchConfig::CALIBRATION_VERSION_SPO2};
  else if(!qualityAcceptable) sp={NAN,SpO2Status::LOW_QUALITY,q,currentReasons,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_SPO2,VitalWatchConfig::CALIBRATION_VERSION_SPO2};
  else sp={NAN,SpO2Status::INSUFFICIENT_DATA,q,currentReasons,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_SPO2,VitalWatchConfig::CALIBRATION_VERSION_SPO2};
}

void pushSpO2(uint32_t red,uint32_t ir){
  if(++decim<PPGConfig::SPO2_DECIMATION)return;decim=0;
  if(!bufferFull){redBuf[bufCount]=red;irBuf[bufCount]=ir;if(++bufCount>=PPGConfig::SPO2_N){bufferFull=true;newCount=0;calculateMaxim();}return;}
  if(newCount==0){for(int32_t i=PPGConfig::SPO2_NEW;i<PPGConfig::SPO2_N;++i){irBuf[i-PPGConfig::SPO2_NEW]=irBuf[i];redBuf[i-PPGConfig::SPO2_NEW]=redBuf[i];}}
  const int32_t pos=PPGConfig::SPO2_N-PPGConfig::SPO2_NEW+newCount;irBuf[pos]=ir;redBuf[pos]=red;if(++newCount>=PPGConfig::SPO2_NEW){newCount=0;calculateMaxim();}
}

void setLed(uint8_t v){led=v;diag.ledAmplitude=v;sensor.setPulseAmplitudeRed(v);sensor.setPulseAmplitudeIR(v);}
void autoGain(){
  if(irSmooth<PPGConfig::AUTOGAIN_START)return;uint8_t next=led;
  if(irSmooth<PPGConfig::IR_TARGET_MIN&&led<PPGConfig::LED_MAX)next=(uint8_t)min((int)PPGConfig::LED_MAX,(int)led+PPGConfig::LED_STEP);
  else if(irSmooth>PPGConfig::IR_TARGET_MAX&&led>PPGConfig::LED_MIN)next=(uint8_t)max((int)PPGConfig::LED_MIN,(int)led-PPGConfig::LED_STEP);
  if(next!=led)setLed(next);
}

void onContact(){contact=true;diag.contact=true;diag.sessionId=++sessionCounter;stabilizing=true;stabilizingStartedMs=millis();lastAutogainMs=stabilizingStartedMs;resetAlgorithms(true);session=MeasurementSessionState::STABILIZING;hr={NAN,HeartRateStatus::INSUFFICIENT_DATA,SignalQuality::POOR,QR_NONE,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};sp={NAN,SpO2Status::INSUFFICIENT_DATA,SignalQuality::POOR,QR_NONE,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_SPO2,VitalWatchConfig::CALIBRATION_VERSION_SPO2};resetDisplayResults();Serial.printf("[INFO][PPG] sesion=%lu contacto confirmado; estabilizando\n",(unsigned long)diag.sessionId);}
void onLostContact(){contact=false;diag.contact=false;stabilizing=false;contactCandidateUs=noContactCandidateUs=0;resetAlgorithms(true);session=MeasurementSessionState::WAITING_CONTACT;hr={NAN,HeartRateStatus::NO_CONTACT,SignalQuality::NO_SIGNAL,QR_NO_CONTACT,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};sp={NAN,SpO2Status::NO_CONTACT,SignalQuality::NO_SIGNAL,QR_NO_CONTACT,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_SPO2,VitalWatchConfig::CALIBRATION_VERSION_SPO2};resetDisplayResults();Serial.println(F("[INFO][PPG] Contacto perdido; esperando dedo"));}

void updateContact(const PPGSample&s){
  // [BIOSYS-G6] Máquina de contacto con histéresis temporal.
  if(!contact){
    if(irSmooth>PPGConfig::CONTACT_THRESHOLD)contactCandidateUs+=PPGConfig::SAMPLE_PERIOD_US;else contactCandidateUs=0;
    if(contactCandidateUs>=PPGConfig::CONTACT_CONFIRM_US){contactCandidateUs=0;noContactCandidateUs=0;onContact();}
  }else{
    if(irSmooth<PPGConfig::REMOVE_THRESHOLD)noContactCandidateUs+=PPGConfig::SAMPLE_PERIOD_US;else noContactCandidateUs=0;
    if(noContactCandidateUs>=PPGConfig::CONTACT_LOST_CONFIRM_US)onLostContact();
  }
}

void updateHRResult(const PPGSample&s){
  const SignalQuality q=evaluateQuality();float robust=NAN;bool unstable=false;
  if(diag.missingSamplesInWindow||!s.timingValid){hr={NAN,HeartRateStatus::TIMING_INVALID,q,(uint16_t)(currentReasons|QR_TIMING_INVALID),s.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};return;}
  if(!contact){hr={NAN,HeartRateStatus::NO_CONTACT,SignalQuality::NO_SIGNAL,QR_NO_CONTACT,s.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};return;}
  if(!qualityAcceptable&&bufferFull){hr={NAN,HeartRateStatus::LOW_QUALITY,q,currentReasons,s.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};return;}
  if(robustBpm(robust,unstable)){
    hr={robust,HeartRateStatus::VALID,q,currentReasons,s.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};
    return;
  }
  if(qualityAcceptable&&maximHRValid&&maximHR>=40&&maximHR<=180){
    hr={(float)maximHR,HeartRateStatus::UNSTABLE,q,(uint16_t)(currentReasons|QR_IBI_INCONSISTENT),s.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};
    return;
  }
  float aproximado=NAN;
  if(qualityAcceptable&&approximateBpm(aproximado)){
    hr={aproximado,HeartRateStatus::UNSTABLE,q,(uint16_t)(currentReasons|QR_IBI_INCONSISTENT),s.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};
    return;
  }
  hr={NAN,unstable?HeartRateStatus::UNSTABLE:HeartRateStatus::INSUFFICIENT_DATA,q,currentReasons,s.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};
}

void finishResearchRecord(const PPGSample&s,float ac,uint8_t peaks,uint32_t processingStart){
  BioResearch::logPPG(s,dcIR,ac,filtered,peaks,lastIbiMs,bpmInstant,hr,sp,diag,session,micros()-processingStart);
  if(missingSamplesRemaining>0)--missingSamplesRemaining;
  diag.missingSamplesInWindow=missingSamplesRemaining>0;
}

void processSample(const PPGSample&s){
  // [BIOSYS-G7] Canal único por muestra: timing, contacto, calidad, HR, SpO2 e investigación.
  const uint32_t processingStart=micros();latest=s;++diag.samplesProcessed;
  if(!s.timingValid)++diag.timingInvalidSamples;
  diag.missingSamplesInWindow=missingSamplesRemaining>0;
  if(irSmooth==0)irSmooth=s.ir;else irSmooth=(uint32_t)(((uint64_t)irSmooth*7ULL+s.ir)/8ULL);

  // En BIO 0.6.0 la autoganancia solo se ejecutaba despues de confirmar el
  // contacto. Eso dejaba sin salida a una señal de dedo real que superaba el
  // umbral de inicio (7000), pero todavía no el umbral de contacto (14000).
  // El ajuste previo conserva exactamente los mismos limites y pasos; solo
  // corrige el orden para que la ganancia pueda ayudar a confirmar el dedo.
  const uint32_t nowMs=millis();
  if(!contact && irSmooth>=PPGConfig::AUTOGAIN_START &&
     nowMs-lastAutogainMs>=PPGConfig::AUTOGAIN_MS){
    lastAutogainMs=nowMs;
    autoGain();
  }

  updateContact(s);if(!contact){finishResearchRecord(s,0,PEAK_NONE,processingStart);return;}

  if(stabilizing){
    if(nowMs-lastAutogainMs>=PPGConfig::AUTOGAIN_MS){lastAutogainMs=nowMs;autoGain();}
    if(nowMs-stabilizingStartedMs>=PPGConfig::STABILIZE_MS){stabilizing=false;measuringStartedMs=nowMs;resetAlgorithms(true);session=MeasurementSessionState::MEASURING;Serial.println(F("[INFO][PPG] Estabilizacion completa; midiendo"));}
    finishResearchRecord(s,0,PEAK_NONE,processingStart);return;
  }

  float ac=0;const uint8_t peaks=processPeaks(s,ac);pushSpO2(s.red,s.ir);updateHRResult(s);publishDisplayResults();
  if(hr.status==HeartRateStatus::VALID||
     (hr.status==HeartRateStatus::UNSTABLE&&!isnan(hr.bpm))||
     sp.status==SpO2Status::EXPERIMENTAL_VALID)session=MeasurementSessionState::RESULT_READY;
  else if((millis()-measuringStartedMs)>=PPGConfig::SESSION_TIMEOUT_MS)session=MeasurementSessionState::TIMEOUT;
  else if(hr.status==HeartRateStatus::LOW_QUALITY||sp.status==SpO2Status::LOW_QUALITY)session=MeasurementSessionState::LOW_QUALITY;
  else session=MeasurementSessionState::MEASURING;

  finishResearchRecord(s,ac,peaks,processingStart);
}

bool connectSensor(){
  systemHealth.ppgReady=false;diag.ledAmplitude=PPGConfig::LED_INITIAL;diag.researchSpo2Candidate=NAN;setError("SIN ACK 0x57");session=MeasurementSessionState::SENSOR_ERROR;
  hr={NAN,HeartRateStatus::SENSOR_ERROR,SignalQuality::NO_SIGNAL,QR_NONE,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_HR};
  sp={NAN,SpO2Status::SENSOR_ERROR,SignalQuality::NO_SIGNAL,QR_NONE,latest.sampleTimeUs,VitalWatchConfig::ALGORITHM_VERSION_SPO2,VitalWatchConfig::CALIBRATION_VERSION_SPO2};
  resetDisplayResults();
  if(!I2CBusService::addressResponds(PPGConfig::ADDRESS)){Serial.println(F("[WARN][PPG] MAX30102 sin ACK 0x57"));return false;}
  for(uint8_t attempt=1;attempt<=3;++attempt){
    if(sensor.begin(Wire,I2C_SPEED_STANDARD)){diag.partId=sensor.readPartID();systemHealth.ppgReady=true;setError("OK");break;}
    setError("ID/BEGIN FALLO");I2CBusService::restoreConfig();delay(100);
  }
  if(!systemHealth.ppgReady){Serial.printf("[ERROR][PPG] %s\n",diag.error);return false;}

  led=PPGConfig::LED_INITIAL;
  sensor.setup(led,PPGConfig::FIFO_AVG,PPGConfig::LED_MODE,PPGConfig::SENSOR_RATE,PPGConfig::PULSE_WIDTH_US,PPGConfig::ADC_RANGE);
  setLed(led);sensor.setPulseAmplitudeGreen(0);sensor.clearFIFO();I2CBusService::restoreConfig();
  sequence=0;lastServiceUs=0;lastEstimatedSampleUs=0;lastTimestampSequence=0;
  lastSoftwareOverflow=0;lastShortRead=0;lastHardwareOverflowTotal=0;
  diag.hardwareOverflowTotal=0;diag.softwareOverflowTotal=0;
  diag.shortReadTotal=0;diag.sequenceGapTotal=0;diag.suspectedSoftwareDrops=0;
  alignFifoOnFirstService=true;
  contact=false;diag.contact=false;contactCandidateUs=noContactCandidateUs=0;irSmooth=0;lastAutogainMs=0;resetAlgorithms(false);resetDisplayResults();session=MeasurementSessionState::WAITING_CONTACT;
  Serial.printf("[INFO][PPG] MAX30102 PART_ID=0x%02X %uHz/AVG%u => ~%lu FIFO records/s\n",diag.partId,(unsigned)PPGConfig::SENSOR_RATE,(unsigned)PPGConfig::FIFO_AVG,(unsigned long)PPGConfig::EFFECTIVE_RATE_HZ);
  return true;
}
}

namespace PPGService {
// [BIOSYS-G8] API pública no bloqueante consumida por BIOSYS.
void begin(){
#if BIO_REPLAY_MODE
  resetReplay();systemHealth.ppgReady=true;setError("REPLAY");
#else
  connectSensor();
#endif
}
void forceReconnect(){connectSensor();}
bool isReady(){return systemHealth.ppgReady;}
MeasurementSessionState sessionState(){return session;}
const HeartRateResult& heartRate(){return hrDisplay;}
const SpO2Result& spo2(){return spDisplay;}
const PPGDiagnostics& diagnostics(){return diag;}
const PPGSample& latestSample(){return latest;}

void update(){
#if BIO_REPLAY_MODE
  return;
#endif
  if(!systemHealth.ppgReady)return;
  // El sensor comienza a convertir durante setup(), antes de que Wi-Fi y los
  // demás servicios terminen de inicializar. Alinear aquí una sola vez evita
  // comenzar el loop con 32 muestras antiguas y el FIFO ya desbordado.
  if(alignFifoOnFirstService){
    sensor.clearFIFO();
    alignFifoOnFirstService=false;
    lastSoftwareOverflow=lastShortRead=lastHardwareOverflowTotal=0;
    Serial.println(F("[INFO][PPG] FIFO alineado al iniciar servicio cooperativo"));
    return;
  }
  const uint64_t nowUs=MonotonicMicros::now();
  if(lastServiceUs){const uint32_t gap=(uint32_t)(nowUs-lastServiceUs);runtimeMetrics.ppgServiceGapUs=gap;if(gap>runtimeMetrics.ppgServiceGapMaxUs)runtimeMetrics.ppgServiceGapMaxUs=gap;if(gap>diag.maxServiceGapUs)diag.maxServiceGapUs=gap;}
  lastServiceUs=nowUs;

  const uint16_t acquired=sensor.check();
  const uint16_t found=sensor.getLastCheckFound();
  diag.lastCheckCount=found;diag.checkSamplesTotal+=found;
  const uint8_t available=sensor.available();diag.lastAvailable=available;
  if(available>diag.maxFifoBacklog)diag.maxFifoBacklog=available;
  diag.hwReadPointer=sensor.getLastReadPointer();diag.hwWritePointer=sensor.getLastWritePointer();
  diag.hwOverflowCounter=sensor.getLastHardwareOverflow();
  diag.lastReadStatus=(uint8_t)sensor.getLastReadStatus();

  const uint32_t softwareNow=sensor.getSoftwareOverflowCount();
  const uint32_t shortNow=sensor.getShortReadCount();
  const uint32_t softwareDelta=softwareNow-lastSoftwareOverflow;
  const uint32_t shortDelta=shortNow-lastShortRead;
  lastSoftwareOverflow=softwareNow;lastShortRead=shortNow;
  diag.softwareOverflowTotal+=softwareDelta;
  diag.shortReadTotal+=shortDelta;
  diag.suspectedSoftwareDrops=diag.softwareOverflowTotal;

  const uint32_t hardwareNow=sensor.getHardwareOverflowCount();
  const uint32_t hardwareObservedDelta=hardwareNow-lastHardwareOverflowTotal;
  lastHardwareOverflowTotal=hardwareNow;
  // En el módulo físico probado OVF_COUNTER devuelve 1 por muestra aun con
  // backlog 1 y servicio a 25 Hz. Se conserva el byte RAW, pero solo se afirma
  // pérdida si existe capacidad temporal o backlog compatibles con FIFO lleno.
  const bool hardwareOverflowCorroborated=hardwareObservedDelta>0 &&
    (found>=PPGConfig::HARDWARE_FIFO_CAPACITY-1 ||
     runtimeMetrics.ppgServiceGapUs>=
       PPGConfig::SAMPLE_PERIOD_US*PPGConfig::HARDWARE_FIFO_CAPACITY);
  const uint32_t hardwareDelta=hardwareOverflowCorroborated?hardwareObservedDelta:0;
  diag.hardwareOverflowTotal+=hardwareDelta;

  const uint32_t shortLost=found>acquired?(uint32_t)(found-acquired):0;
  const uint32_t lost=hardwareDelta+softwareDelta+shortLost;
  if(lost){
    diag.sequenceGapTotal+=lost;sequence+=lost;
    // La invalidez dura una ventana optica completa y despues se recupera. En
    // la entrega original este flag quedaba activo para siempre hasta retirar
    // el dedo, aun cuando ya no quedaban muestras afectadas en el buffer.
    missingSamplesRemaining=PPGConfig::SPO2_N*PPGConfig::SPO2_DECIMATION;
    diag.missingSamplesInWindow=true;
    BioResearch::logLossEvent(hardwareDelta,softwareDelta,shortLost,sequence);
  }

  const uint8_t n=min((uint8_t)PPGConfig::MAX_VISIBLE_SAMPLES_PER_UPDATE,available);
  for(uint8_t i=0;i<n&&sensor.available();++i){
    PPGSample s;
    s.red=sensor.getFIFORed();s.ir=sensor.getFIFOIR();sensor.nextSample();
    s.sequence=++sequence;
    if(lastEstimatedSampleUs==0){
      s.sampleTimeUs=nowUs-(uint64_t)(n-1-i)*PPGConfig::SAMPLE_PERIOD_US;
    }else{
      const uint32_t sequenceDelta=s.sequence-lastTimestampSequence;
      s.sampleTimeUs=lastEstimatedSampleUs+(uint64_t)sequenceDelta*PPGConfig::SAMPLE_PERIOD_US;
    }
    lastEstimatedSampleUs=s.sampleTimeUs;lastTimestampSequence=s.sequence;
    s.serviceTimeUs=nowUs;
    s.timestampSource=PPGTimestampSource::ESTIMATED_PERIODIC;
    s.readValid=true;
    // Se usa el gap ACTUAL para validar esta tanda; el maximo historico queda
    // solo como diagnostico. Asi una pausa aislada no invalida toda la sesion.
    s.timingValid=!diag.missingSamplesInWindow && shortDelta==0 &&
      (runtimeMetrics.ppgServiceGapUs < PPGConfig::SAMPLE_PERIOD_US*4UL);
    processSample(s);
  }
}

void resetReplay(){
  contact=false;diag.contact=false;contactCandidateUs=noContactCandidateUs=0;sequence=0;lastServiceUs=0;
  lastEstimatedSampleUs=0;lastTimestampSequence=0;lastSoftwareOverflow=0;lastShortRead=0;lastHardwareOverflowTotal=0;
  alignFifoOnFirstService=true;
  irSmooth=0;lastAutogainMs=0;resetAlgorithms(false);resetDisplayResults();session=MeasurementSessionState::WAITING_CONTACT;
}
void processReplaySample(const PPGSample&s){processSample(s);}
}

const char* nombreEstadoHR(HeartRateStatus s){switch(s){case HeartRateStatus::VALID:return "VALIDA";case HeartRateStatus::INSUFFICIENT_DATA:return "SIN DATOS";case HeartRateStatus::UNSTABLE:return "INESTABLE";case HeartRateStatus::LOW_QUALITY:return "SENAL BAJA";case HeartRateStatus::NO_CONTACT:return "SIN DEDO";case HeartRateStatus::TIMING_INVALID:return "TIEMPO";default:return "ERROR";}}
const char* nombreEstadoSpO2(SpO2Status s){switch(s){case SpO2Status::EXPERIMENTAL_VALID:return "EXP VALIDA";case SpO2Status::INVALID:return "INVALIDA";case SpO2Status::LOW_QUALITY:return "SENAL BAJA";case SpO2Status::NO_CONTACT:return "SIN DEDO";case SpO2Status::INSUFFICIENT_DATA:return "SIN DATOS";default:return "ERROR";}}
const char* nombreSesionPPG(MeasurementSessionState s){switch(s){case MeasurementSessionState::WAITING_CONTACT:return "PONGA EL DEDO";case MeasurementSessionState::STABILIZING:return "ESTABILIZANDO";case MeasurementSessionState::MEASURING:return "MIDIENDO";case MeasurementSessionState::RESULT_READY:return "RESULTADO";case MeasurementSessionState::LOW_QUALITY:return "SENAL BAJA";case MeasurementSessionState::CANCELLED:return "CANCELADA";case MeasurementSessionState::TIMEOUT:return "TIEMPO AGOTADO";default:return "ERROR SENSOR";}}
