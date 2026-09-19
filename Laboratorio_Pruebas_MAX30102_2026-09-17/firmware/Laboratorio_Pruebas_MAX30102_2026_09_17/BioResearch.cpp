#include "BioResearch.h"
#include "Configuracion.h"
#include "SystemState.h"
#include "MonotonicMicros.h"
#include <ctype.h>
#include <stdlib.h>
#include <string.h>

/* CODEX LAB LOGGER: observabilidad; no modifica el algoritmo biomédico. */
#if BIO_RESEARCH_MODE
namespace {
struct Record {
  PPGSample ppg;
  float irDc,irAc,irFiltered;
  uint8_t peaks;
  uint16_t ibiMs;
  float bpmInstant;
  HeartRateResult hr;
  SpO2Result spo2;
  PPGDiagnostics ppgDiag;
  MeasurementSessionState measurementSession;
  MotionSample motion;
  MotionDiagnostics motionDiag;
  uint32_t processingUs,loopLastUs,loopMaxUs,displayRenderUs,i2cFailures;
};

constexpr uint8_t QUEUE_SIZE=12;
Record queue[QUEUE_SIZE];
uint8_t head=0,tail=0,count=0;
uint32_t dropped=0,sessionId=0,sessionSamples=0;
BioResearch::LogMode currentMode=BioResearch::LogMode::OFF;
bool active=false;
char testId[32]="UNSET",subjectId[32]="UNSET";
char tx[1024];
size_t txLen=0,txPos=0;

struct PendingLoss {
  uint32_t hardware,software,shortRead,sequence;
  bool pending;
} pendingLoss={0,0,0,0,false};

const char* modeName(BioResearch::LogMode value){
  switch(value){case BioResearch::LogMode::RAW:return "RAW";case BioResearch::LogMode::FULL:return "FULL";default:return "OFF";}
}

bool safeToken(const char *value){
  if(!value||!*value)return false;
  for(size_t i=0;value[i];++i){
    const char c=value[i];
    if(!(isalnum((unsigned char)c)||c=='_'||c=='-'||c=='.'))return false;
    if(i>=30)return false;
  }
  return true;
}

bool enqueue(const Record &record){
  if(count>=QUEUE_SIZE){++dropped;return false;}
  queue[head]=record;head=(head+1)%QUEUE_SIZE;++count;return true;
}

void emitMetadata(){
  Serial.println(F("@VW_META,schema_version,1"));
  Serial.printf("@VW_META,lab_id,%s\n",VitalWatchConfig::LAB_ID);
  Serial.printf("@VW_META,baseline_sha256,%s\n",VitalWatchConfig::BASELINE_SHA256);
  Serial.printf("@VW_META,firmware_product,%s\n",VitalWatchConfig::VERSION_PRODUCTO);
  Serial.printf("@VW_META,firmware_sys,%s\n",VitalWatchConfig::VERSION_SISTEMA);
  Serial.printf("@VW_META,firmware_bio,%s\n",VitalWatchConfig::VERSION_BIOMEDICA);
  Serial.printf("@VW_META,serial_baud,%lu\n",(unsigned long)VitalWatchConfig::LAB_SERIAL_BAUD);
  Serial.println(F("@VW_META,sensor,MAX30102"));
  Serial.println(F("@VW_META,driver,SparkFun_MAX3010x_Lab_1.1.2-derived"));
  Serial.println(F("@VW_META,timestamp_source,ESTIMATED_PERIODIC"));
  Serial.println(F("@VW_META,sensor_rate_hz,100"));
  Serial.println(F("@VW_META,fifo_average,4"));
  Serial.println(F("@VW_META,effective_rate_hz,25"));
  Serial.println(F("@VW_META,sample_period_us,40000"));
  Serial.printf("@VW_META,i2c_sda,%u\n",(unsigned)VitalWatchConfig::PIN_I2C_SDA);
  Serial.printf("@VW_META,i2c_scl,%u\n",(unsigned)VitalWatchConfig::PIN_I2C_SCL);
  Serial.printf("@VW_META,i2c_hz,%lu\n",(unsigned long)VitalWatchConfig::FRECUENCIA_I2C_HZ);
  Serial.printf("@VW_META,test_id,%s\n",testId);
  Serial.printf("@VW_META,subject_id,%s\n",subjectId);
  Serial.printf("@VW_META,log_mode,%s\n",modeName(currentMode));
  Serial.println(F("@VW_META,clinical_use,NO"));
}

void emitStatus(){
  const PPGDiagnostics &p=PPGService::diagnostics();
  Serial.printf("@VW_STAT,%lu,%llu,%s,%u,%u,%lu,%lu,%lu,%lu,%lu,%lu,%u\n",
    (unsigned long)sessionId,(unsigned long long)MonotonicMicros::now(),modeName(currentMode),
    active?1u:0u,(unsigned)count,(unsigned long)dropped,(unsigned long)sessionSamples,
    (unsigned long)p.hardwareOverflowTotal,(unsigned long)p.softwareOverflowTotal,
    (unsigned long)p.shortReadTotal,(unsigned long)p.sequenceGapTotal,(unsigned)p.maxFifoBacklog);
}

void buildLossLine(){
  if(!pendingLoss.pending||txPos<txLen)return;
  txLen=(size_t)snprintf(tx,sizeof(tx),
    "@VW_EVT,%lu,%llu,ACQUISITION_LOSS,%lu,%lu,%lu,sequence_after_%lu\n",
    (unsigned long)sessionId,(unsigned long long)MonotonicMicros::now(),
    (unsigned long)pendingLoss.hardware,(unsigned long)pendingLoss.software,
    (unsigned long)pendingLoss.shortRead,(unsigned long)pendingLoss.sequence);
  if(txLen>=sizeof(tx))txLen=sizeof(tx)-1;
  txPos=0;pendingLoss={0,0,0,0,false};
}

void buildSampleLine(){
  if(count==0||txPos<txLen)return;
  const Record&r=queue[tail];tail=(tail+1)%QUEUE_SIZE;--count;
  const char *source=r.ppg.timestampSource==PPGTimestampSource::ESTIMATED_PERIODIC?"ESTIMATED_PERIODIC":"UNKNOWN";
  const float axG=r.motion.axMs2/9.80665f,ayG=r.motion.ayMs2/9.80665f,azG=r.motion.azMs2/9.80665f;
  const bool saturated=r.motion.accelSaturated||r.motion.gyroSaturated;
  txLen=(size_t)snprintf(tx,sizeof(tx),
    "@VW_RAW,1,%lu,%lu,%llu,%llu,%s,%u,%u,%lu,%lu,%u,%u,%u,%lu,%lu,%lu,%lu,%lu,%u,%llu,%.6f,%.6f,%.6f,%.6f,%.6f,%lu,%u",
    (unsigned long)sessionId,(unsigned long)r.ppg.sequence,
    (unsigned long long)r.ppg.sampleTimeUs,(unsigned long long)r.ppg.serviceTimeUs,source,
    r.ppg.readValid?1u:0u,r.ppg.timingValid?1u:0u,
    (unsigned long)r.ppg.red,(unsigned long)r.ppg.ir,
    (unsigned)r.ppgDiag.lastCheckCount,(unsigned)r.ppgDiag.lastAvailable,
    (unsigned)r.ppgDiag.hwOverflowCounter,(unsigned long)r.ppgDiag.hardwareOverflowTotal,
    (unsigned long)r.ppgDiag.softwareOverflowTotal,(unsigned long)r.ppgDiag.shortReadTotal,
    (unsigned long)r.ppgDiag.sequenceGapTotal,(unsigned long)dropped,
    r.motion.valid?1u:0u,(unsigned long long)r.motion.timestampUs,
    axG,ayG,azG,r.motion.accelerationMagnitudeG,r.motion.gyroMagnitudeRadS,
    (unsigned long)r.motion.dtUs,saturated?1u:0u);
  if(currentMode==BioResearch::LogMode::FULL && txLen<sizeof(tx)){
    const size_t used=txLen;
    const int added=snprintf(tx+used,sizeof(tx)-used,
      ",%.3f,%.3f,%.3f,%u,%u,%.3f,%.3f,%u,%u,%u,%.3f,%u,%u,%u,%ld,%d,%.3f,%u,%lu,%lu,%lu,%lu,%lu",
      r.irDc,r.irAc,r.irFiltered,(unsigned)r.peaks,(unsigned)r.ibiMs,
      r.bpmInstant,r.hr.bpm,(unsigned)r.hr.status,(unsigned)r.hr.quality,
      (unsigned)r.hr.qualityReasons,r.spo2.spo2Estimate,(unsigned)r.spo2.status,
      (unsigned)r.spo2.quality,(unsigned)r.ppgDiag.ledAmplitude,
      (long)r.ppgDiag.maximSpo2,(int)r.ppgDiag.maximSpo2Valid,
      r.ppgDiag.researchSpo2Candidate,(unsigned)r.measurementSession,
      (unsigned long)r.processingUs,(unsigned long)r.loopLastUs,
      (unsigned long)r.loopMaxUs,(unsigned long)r.displayRenderUs,
      (unsigned long)r.i2cFailures);
    if(added>0)txLen=used+(size_t)added;
  }
  if(txLen>=sizeof(tx)-2)txLen=sizeof(tx)-2;
  tx[txLen++]='\n';tx[txLen]='\0';txPos=0;
}

void finishPendingLine(){
  if(txPos<txLen)Serial.write((const uint8_t*)tx+txPos,txLen-txPos);
  txPos=txLen=0;
  Serial.flush();
}

void flushSessionQueue(){
  finishPendingLine();
  while(pendingLoss.pending||count){
    buildLossLine();buildSampleLine();
    finishPendingLine();
  }
}
}
#endif

namespace BioResearch {
void begin(){
#if BIO_RESEARCH_MODE
  Serial.printf("[INFO][BIO-LAB] listo; modo=%s; use BIO HELP\n",modeName(currentMode));
#endif
}

void logPPG(const PPGSample&s,float dc,float ac,float filtered,uint8_t peaks,
            uint16_t ibi,float bpmInstant,const HeartRateResult&hr,
            const SpO2Result&spo2,const PPGDiagnostics&diag,
            MeasurementSessionState measurementSession,uint32_t processingUs){
#if BIO_RESEARCH_MODE
  if(!active||currentMode==LogMode::OFF)return;
  Record record={s,dc,ac,filtered,peaks,ibi,bpmInstant,hr,spo2,diag,measurementSession,
    MotionService::latest(),MotionService::diagnostics(),processingUs,
    runtimeMetrics.loopLastUs,runtimeMetrics.loopMaxUs,
    runtimeMetrics.displayRenderLastUs,systemHealth.i2cErrors};
  if(enqueue(record))++sessionSamples;
#else
  (void)s;(void)dc;(void)ac;(void)filtered;(void)peaks;(void)ibi;(void)bpmInstant;
  (void)hr;(void)spo2;(void)diag;(void)measurementSession;(void)processingUs;
#endif
}

void logLossEvent(uint32_t hardware,uint32_t software,uint32_t shortRead,uint32_t sequence){
#if BIO_RESEARCH_MODE
  if(!active||currentMode==LogMode::OFF)return;
  pendingLoss.hardware+=hardware;pendingLoss.software+=software;
  pendingLoss.shortRead+=shortRead;pendingLoss.sequence=sequence;pendingLoss.pending=true;
#else
  (void)hardware;(void)software;(void)shortRead;(void)sequence;
#endif
}

void update(){
#if BIO_RESEARCH_MODE
  if(txPos>=txLen){txPos=txLen=0;buildLossLine();buildSampleLine();}
  if(txPos>=txLen)return;
  // Una única llamada mantiene el mutex UART del core ESP32 durante toda la
  // línea. Evita que logs Wi-Fi del segundo núcleo partan un registro @VW_*.
  Serial.write((const uint8_t*)tx+txPos,txLen-txPos);txPos=txLen;
#endif
}

bool handleSerialLine(char *line){
#if BIO_RESEARCH_MODE
  if(!line)return false;
  char *save=nullptr;
  char *root=strtok_r(line," \t",&save);
  if(!root||strcmp(root,"BIO")!=0)return false;
  // Los comandos son poco frecuentes y explícitos. Terminar la línea en curso
  // impide que una respuesta de control se inserte dentro de un @VW_RAW.
  finishPendingLine();
  char *command=strtok_r(nullptr," \t",&save);
  if(!command){Serial.println(F("[WARN][BIO-LAB] comando incompleto; BIO HELP"));return true;}
  if(strcmp(command,"HELP")==0){
    Serial.println(F("[INFO][BIO-LAB] BIO MODE OFF|RAW|FULL | BIO TEST START <test> <subject> | BIO TEST STOP | BIO MARK <tag> | BIO REF HR|SPO2 <value> | BIO STATUS"));return true;
  }
  if(strcmp(command,"MODE")==0){
    if(active){Serial.println(F("[WARN][BIO-LAB] no cambie MODE durante una sesion"));return true;}
    char *value=strtok_r(nullptr," \t",&save);
    if(value&&strcmp(value,"OFF")==0)currentMode=LogMode::OFF;
    else if(value&&strcmp(value,"RAW")==0)currentMode=LogMode::RAW;
    else if(value&&strcmp(value,"FULL")==0)currentMode=LogMode::FULL;
    else {Serial.println(F("[WARN][BIO-LAB] modo invalido"));return true;}
    Serial.printf("[INFO][BIO-LAB] modo=%s\n",modeName(currentMode));return true;
  }
  if(strcmp(command,"TEST")==0){
    char *action=strtok_r(nullptr," \t",&save);
    if(action&&strcmp(action,"START")==0){
      char *test=strtok_r(nullptr," \t",&save),*subject=strtok_r(nullptr," \t",&save);
      if(!safeToken(test)||!safeToken(subject)){Serial.println(F("[WARN][BIO-LAB] use IDs alfanumericos, _ - o . (max 31)"));return true;}
      if(active){Serial.println(F("[WARN][BIO-LAB] ya existe una sesion activa"));return true;}
      if(currentMode==LogMode::OFF){Serial.println(F("[WARN][BIO-LAB] seleccione RAW o FULL antes de START"));return true;}
      snprintf(testId,sizeof(testId),"%s",test);snprintf(subjectId,sizeof(subjectId),"%s",subject);
      sessionId=(uint32_t)(MonotonicMicros::now()&0xFFFFFFFFu);if(sessionId==0)sessionId=1;
      sessionSamples=0;dropped=0;head=tail=count=0;txLen=txPos=0;pendingLoss={0,0,0,0,false};active=true;
      emitMetadata();Serial.printf("@VW_EVT,%lu,%llu,SESSION_START,0,0,0,%s\n",(unsigned long)sessionId,(unsigned long long)MonotonicMicros::now(),testId);
      return true;
    }
    if(action&&strcmp(action,"STOP")==0){
      active=false;
      flushSessionQueue();
      Serial.printf("@VW_EVT,%lu,%llu,SESSION_STOP,%lu,%lu,0,normal\n",(unsigned long)sessionId,(unsigned long long)MonotonicMicros::now(),(unsigned long)sessionSamples,(unsigned long)dropped);
      emitStatus();return true;
    }
  }
  if(strcmp(command,"MARK")==0){
    char *tag=strtok_r(nullptr," \t",&save);if(!safeToken(tag)){Serial.println(F("[WARN][BIO-LAB] marca invalida"));return true;}
    Serial.printf("@VW_EVT,%lu,%llu,MARK,0,0,0,%s\n",(unsigned long)sessionId,(unsigned long long)MonotonicMicros::now(),tag);return true;
  }
  if(strcmp(command,"REF")==0){
    char *kind=strtok_r(nullptr," \t",&save),*value=strtok_r(nullptr," \t",&save);
    if(!kind||!value||(strcmp(kind,"HR")!=0&&strcmp(kind,"SPO2")!=0)){Serial.println(F("[WARN][BIO-LAB] use BIO REF HR|SPO2 <valor>"));return true;}
    char *end=nullptr;const float number=strtof(value,&end);if(end==value||*end!='\0'){Serial.println(F("[WARN][BIO-LAB] referencia no numerica"));return true;}
    Serial.printf("@VW_REF,%lu,%llu,%s,%.3f,MANUAL\n",(unsigned long)sessionId,(unsigned long long)MonotonicMicros::now(),kind,number);return true;
  }
  if(strcmp(command,"STATUS")==0){emitStatus();return true;}
  Serial.println(F("[WARN][BIO-LAB] comando desconocido; BIO HELP"));return true;
#else
  (void)line;return false;
#endif
}

uint32_t droppedRecords(){
#if BIO_RESEARCH_MODE
  return dropped;
#else
  return 0;
#endif
}
LogMode mode(){
#if BIO_RESEARCH_MODE
  return currentMode;
#else
  return LogMode::OFF;
#endif
}
bool sessionActive(){
#if BIO_RESEARCH_MODE
  return active;
#else
  return false;
#endif
}
}
