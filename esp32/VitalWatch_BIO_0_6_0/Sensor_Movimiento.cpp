#include "Sensor_Movimiento.h"
#include <Wire.h>
#include <math.h>
#include <string.h>
#include "Configuracion.h"
#include "I2CBusService.h"
#include "SystemState.h"

namespace MotionConfig {
constexpr uint8_t ADDRESS_A=0x68, ADDRESS_B=0x69;
constexpr uint8_t REG_SMPLRT_DIV=0x19, REG_CONFIG=0x1A, REG_GYRO_CONFIG=0x1B;
constexpr uint8_t REG_ACCEL_CONFIG=0x1C, REG_ACCEL_XOUT_H=0x3B;
constexpr uint8_t REG_PWR_MGMT_1=0x6B, REG_PWR_MGMT_2=0x6C, REG_WHO_AM_I=0x75;
constexpr uint8_t ID_6050=0x68, ID_6500=0x70, ID_9250=0x71, ID_9255=0x73;

// BASELINE 0.5.0: no modificar aun.
constexpr float ACC_LSB_PER_G=4096.0f;      // +/-8 g
constexpr float GYRO_LSB_PER_DPS=65.5f;     // +/-500 dps
constexpr float G=9.80665f;
// No usar el nombre DEG_TO_RAD aqui: Arduino.h ya lo define como una macro.
// El preprocesador sustituye macros incluso dentro de nombres calificados como
// MotionConfig::DEG_TO_RAD, lo que producia un identificador C++ invalido.
// Este nombre propio evita la colision y conserva exactamente el mismo factor.
constexpr float RADIANS_PER_DEGREE=0.01745329252f;
constexpr uint32_t TARGET_PERIOD_US=10000UL; // objetivo ~100 Hz
constexpr uint32_t RECONNECT_MS=3000UL;
constexpr uint8_t MAX_CONSECUTIVE_ERRORS=4;
constexpr uint32_t IMPACT_LOCKOUT_MS=1400UL;

// Thresholds EXPERIMENTALES heredados. El output sigue siendo POSSIBLE_IMPACT.
constexpr float TH_STRONG_G=1.70f;
constexpr float TH_MODERATE_G=1.32f;
constexpr float TH_DELTA_G=0.48f;
constexpr float TH_GYRO_RAD_S=1.15f;
constexpr float TH_GYRO_DELTA_RAD_S=0.70f;

// Detectores de proximidad a full-scale. 98% evita depender de igualdad exacta.
constexpr int16_t RAW_SATURATION = 32112;
}

namespace {
MotionSample sample = {0,0,0,0,0,0,0,0,0,0,0,false,false,false};
MotionDiagnostics diag = {0,0,0,0,0,0,0,0,0,MotionHardwareStatus::NOT_FOUND,"NO DETECTADO","NO PROBADO"};
PossibleImpactEvent impact = {false,0,0,0,0};
uint64_t lastSampleUs=0;
uint32_t lastReconnectMs=0;
uint32_t lastImpactMs=0;
uint8_t consecutiveErrors=0;
float previousMagnitudeG=1.0f;

void setError(const char* text){ snprintf(diag.error,sizeof(diag.error),"%s",text); }
const char* modelName(uint8_t id){
  switch(id){case MotionConfig::ID_6050:return "MPU6050";case MotionConfig::ID_6500:return "MPU6500";case MotionConfig::ID_9250:return "MPU9250";case MotionConfig::ID_9255:return "MPU9255";default:return "MPU DESCONOCIDO";}
}
bool supportedId(uint8_t id){return id==MotionConfig::ID_6050||id==MotionConfig::ID_6500||id==MotionConfig::ID_9250||id==MotionConfig::ID_9255;}

bool writeReg(uint8_t addr,uint8_t reg,uint8_t value){
  Wire.beginTransmission(addr); Wire.write(reg); Wire.write(value);
  const bool ok=Wire.endTransmission(true)==0; if(!ok) ++systemHealth.i2cErrors; return ok;
}
bool readBlock(uint8_t addr,uint8_t reg,uint8_t* dst,size_t len){
  Wire.beginTransmission(addr); Wire.write(reg);
  if(Wire.endTransmission(false)!=0){++systemHealth.i2cErrors;return false;}
  const size_t got=Wire.requestFrom(addr,len,true);
  if(got!=len){while(Wire.available())Wire.read();++systemHealth.i2cErrors;return false;}
  for(size_t i=0;i<len;++i)dst[i]=Wire.read(); return true;
}
int16_t i16(uint8_t hi,uint8_t lo){return (int16_t)(((uint16_t)hi<<8)|lo);}

bool configure(uint8_t addr){
  // Delays solo durante begin/reconnect; nunca en update() continuo.
  if(!writeReg(addr,MotionConfig::REG_PWR_MGMT_1,0x80)){setError("RESET I2C");return false;}
  delay(100);
  if(!writeReg(addr,MotionConfig::REG_PWR_MGMT_1,0x01)||!writeReg(addr,MotionConfig::REG_PWR_MGMT_2,0x00)){setError("PWR CONFIG");return false;}

  // BASELINE: SMPLRT_DIV=9, DLPF_CFG=4, gyro +/-500, accel +/-8g.
  // DLPF 4 vs 3 queda como experimento futuro, NO cambio permanente en 0.6.0.
  if(!writeReg(addr,MotionConfig::REG_SMPLRT_DIV,9)||
     !writeReg(addr,MotionConfig::REG_CONFIG,0x04)||
     !writeReg(addr,MotionConfig::REG_GYRO_CONFIG,0x08)||
     !writeReg(addr,MotionConfig::REG_ACCEL_CONFIG,0x10)){
    setError("RANGO CONFIG");return false;
  }
  delay(30); return true;
}

bool readSampleNow(){
  if(diag.i2cAddress==0) return false;
  uint8_t b[14];
  if(!readBlock(diag.i2cAddress,MotionConfig::REG_ACCEL_XOUT_H,b,sizeof(b))) return false;

  const int16_t ax=i16(b[0],b[1]), ay=i16(b[2],b[3]), az=i16(b[4],b[5]);
  const int16_t gx=i16(b[8],b[9]), gy=i16(b[10],b[11]), gz=i16(b[12],b[13]);

  const uint64_t nowUs=(uint64_t)micros();
  const uint32_t dt = lastSampleUs ? (uint32_t)(nowUs-lastSampleUs) : MotionConfig::TARGET_PERIOD_US;
  lastSampleUs=nowUs;

  sample.axMs2=(ax/MotionConfig::ACC_LSB_PER_G)*MotionConfig::G;
  sample.ayMs2=(ay/MotionConfig::ACC_LSB_PER_G)*MotionConfig::G;
  sample.azMs2=(az/MotionConfig::ACC_LSB_PER_G)*MotionConfig::G;
  sample.gxRadS=(gx/MotionConfig::GYRO_LSB_PER_DPS)*MotionConfig::RADIANS_PER_DEGREE;
  sample.gyRadS=(gy/MotionConfig::GYRO_LSB_PER_DPS)*MotionConfig::RADIANS_PER_DEGREE;
  sample.gzRadS=(gz/MotionConfig::GYRO_LSB_PER_DPS)*MotionConfig::RADIANS_PER_DEGREE;

  const float magMs2=sqrtf(sample.axMs2*sample.axMs2+sample.ayMs2*sample.ayMs2+sample.azMs2*sample.azMs2);
  sample.accelerationMagnitudeG=magMs2/MotionConfig::G;
  sample.accelerationDeltaG=fabsf(sample.accelerationMagnitudeG-previousMagnitudeG);
  previousMagnitudeG=sample.accelerationMagnitudeG;
  sample.gyroMagnitudeRadS=sqrtf(sample.gxRadS*sample.gxRadS+sample.gyRadS*sample.gyRadS+sample.gzRadS*sample.gzRadS);

  sample.timestampUs=nowUs;
  sample.dtUs=dt;
  sample.jitterUs=(int32_t)dt-(int32_t)MotionConfig::TARGET_PERIOD_US;
  sample.accelSaturated=(abs((int)ax)>=MotionConfig::RAW_SATURATION||abs((int)ay)>=MotionConfig::RAW_SATURATION||abs((int)az)>=MotionConfig::RAW_SATURATION);
  sample.gyroSaturated=(abs((int)gx)>=MotionConfig::RAW_SATURATION||abs((int)gy)>=MotionConfig::RAW_SATURATION||abs((int)gz)>=MotionConfig::RAW_SATURATION);
  sample.valid=true;

  ++diag.samples;
  if(dt>diag.maxDtUs)diag.maxDtUs=dt;
  const uint32_t absJ=(uint32_t)abs(sample.jitterUs);
  if(absJ>diag.maxAbsJitterUs)diag.maxAbsJitterUs=absJ;
  if(dt>=MotionConfig::TARGET_PERIOD_US*2UL) diag.missedDeadlines += (dt/MotionConfig::TARGET_PERIOD_US)-1UL;
  if(sample.accelSaturated)++diag.accelSaturationCount;
  if(sample.gyroSaturated)++diag.gyroSaturationCount;
  return true;
}

bool probe(uint8_t addr){
  if(!I2CBusService::addressResponds(addr)) return false;
  uint8_t id=0;
  if(!I2CBusService::readRegister8(addr,MotionConfig::REG_WHO_AM_I,id)){setError("SIN WHO_AM_I");return false;}
  if(!supportedId(id)){diag.whoAmI=id;setError("ID NO SOPORTADO");return false;}
  if(!configure(addr))return false;

  diag.i2cAddress=addr; diag.whoAmI=id;
  snprintf(diag.model,sizeof(diag.model),"%s",modelName(id));
  diag.hardwareStatus=(id==MotionConfig::ID_6050)?MotionHardwareStatus::MPU6050_VALIDATED_TARGET:MotionHardwareStatus::UNVALIDATED_HARDWARE_VARIANT;
  if(!readSampleNow()){diag.i2cAddress=0;diag.hardwareStatus=MotionHardwareStatus::READ_ERROR;setError("LECTURA FALLO");return false;}
  setError(id==MotionConfig::ID_6050?"OK":"VARIANTE NO VALIDADA");
  systemHealth.imuReady=true; consecutiveErrors=0;
  Serial.printf("[INFO][IMU] %s addr=0x%02X WHO_AM_I=0x%02X status=%s\n",diag.model,addr,id,id==MotionConfig::ID_6050?"TARGET":"UNVALIDATED_VARIANT");
  return true;
}

bool connect(){
  systemHealth.imuReady=false; sample.valid=false; diag.i2cAddress=0; diag.whoAmI=0;
  diag.hardwareStatus=MotionHardwareStatus::NOT_FOUND; snprintf(diag.model,sizeof(diag.model),"NO DETECTADO"); setError("SIN ACK");
  if(probe(MotionConfig::ADDRESS_A))return true;
  if(probe(MotionConfig::ADDRESS_B))return true;
  Serial.printf("[WARN][IMU] No disponible: %s\n",diag.error); return false;
}
}

namespace MotionService {
void begin(){lastSampleUs=0;lastReconnectMs=millis();connect();}
void forceReconnect(){lastReconnectMs=0;connect();}

bool revalidate(){
  if(!systemHealth.imuReady||diag.i2cAddress==0)return false;
  uint8_t id=0;
  if(!I2CBusService::addressResponds(diag.i2cAddress)||!I2CBusService::readRegister8(diag.i2cAddress,MotionConfig::REG_WHO_AM_I,id)||!supportedId(id)){
    systemHealth.imuReady=false; sample.valid=false; setError("POST BUS I2C"); return false;
  }
  return true;
}

void update(){
  const uint64_t serviceNow=(uint64_t)micros();
  static uint64_t previousService=0;
  if(previousService){runtimeMetrics.imuServiceGapUs=(uint32_t)(serviceNow-previousService);if(runtimeMetrics.imuServiceGapUs>runtimeMetrics.imuServiceGapMaxUs)runtimeMetrics.imuServiceGapMaxUs=runtimeMetrics.imuServiceGapUs;}
  previousService=serviceNow;

  if(!systemHealth.imuReady){if((uint32_t)(millis()-lastReconnectMs)>=MotionConfig::RECONNECT_MS){lastReconnectMs=millis();connect();}return;}

  // Cooperative scheduler: due basado en timestamp real, no un delay bloqueante.
  if(lastSampleUs && (uint32_t)(serviceNow-lastSampleUs)<MotionConfig::TARGET_PERIOD_US)return;
  if(!readSampleNow()){
    ++diag.readErrors; ++consecutiveErrors;
    if(consecutiveErrors>=MotionConfig::MAX_CONSECUTIVE_ERRORS){systemHealth.imuReady=false;sample.valid=false;setError("LECTURA I2C");}
    return;
  }
  consecutiveErrors=0;

  const bool strong=sample.accelerationMagnitudeG>=MotionConfig::TH_STRONG_G;
  const bool rotated=sample.accelerationMagnitudeG>=MotionConfig::TH_MODERATE_G&&sample.gyroMagnitudeRadS>=MotionConfig::TH_GYRO_RAD_S;
  const bool deltaRotate=sample.accelerationDeltaG>=MotionConfig::TH_DELTA_G&&sample.gyroMagnitudeRadS>=MotionConfig::TH_GYRO_DELTA_RAD_S;
  const uint32_t nowMs=millis();

  if(!impact.pending && (uint32_t)(nowMs-lastImpactMs)>=MotionConfig::IMPACT_LOCKOUT_MS && (strong||rotated||deltaRotate)){
    lastImpactMs=nowMs;
    impact={true,sample.timestampUs,sample.accelerationMagnitudeG,sample.accelerationDeltaG,sample.gyroMagnitudeRadS};
    Serial.printf("[EVENT][IMU] POSSIBLE_IMPACT |a|=%.2fg delta=%.2fg gyro=%.2frad/s\n",impact.peakG,impact.deltaG,impact.gyroRadS);
  }
}

bool consumePossibleImpact(PossibleImpactEvent &event){if(!impact.pending)return false;event=impact;impact.pending=false;return true;}
void rearmImpactDemo(){lastImpactMs=millis()-MotionConfig::IMPACT_LOCKOUT_MS;impact.pending=false;}
bool isReady(){return systemHealth.imuReady;}
const MotionSample& latest(){return sample;}
const MotionDiagnostics& diagnostics(){return diag;}
}
