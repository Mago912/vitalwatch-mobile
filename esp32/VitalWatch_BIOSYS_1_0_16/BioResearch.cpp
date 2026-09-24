#include "BioResearch.h"
#include "Configuracion.h"
#include "SystemState.h"

/* SOURCE: Biomedical Algorithms Lab, contrato AUTH-019. */

#if BIO_RESEARCH_MODE
namespace {
// [BIOSYS-I1] Registro de laboratorio acotado y cola fija, sin memoria dinámica.
struct Record {
  PPGSample ppg;
  float irDc,irAc,irFiltered;
  uint8_t peaks;
  uint16_t ibiMs;
  float bpmInstant;
  HeartRateResult hr;
  SpO2Result spo2;
  PPGDiagnostics ppgDiag;
  MeasurementSessionState session;
  MotionSample motion;
  MotionDiagnostics motionDiag;
  MotionResearchWindow motionWindow;
  uint32_t processingUs,loopLastUs,loopMaxUs,displayRenderUs,i2cFailures;
};

constexpr uint8_t QUEUE_SIZE=8;
Record queue[QUEUE_SIZE];
uint8_t head=0,tail=0,count=0;
uint32_t dropped=0;
char tx[768];
size_t txLen=0,txPos=0;

bool enqueue(const Record &record){
  if(count>=QUEUE_SIZE){++dropped;return false;}
  queue[head]=record;head=(head+1)%QUEUE_SIZE;++count;return true;
}

void buildLine(){
  // [BIOSYS-I2] Serialización CSV diferida para no bloquear la adquisición.
  if(count==0||txPos<txLen)return;
  const Record&r=queue[tail];tail=(tail+1)%QUEUE_SIZE;--count;
  const float axG=r.motion.axMs2/9.80665f,ayG=r.motion.ayMs2/9.80665f,azG=r.motion.azMs2/9.80665f;
  const bool mpuSaturated=r.motion.accelSaturated||r.motion.gyroSaturated;
  txLen=(size_t)snprintf(tx,sizeof(tx),
    "PPG,%lu,%lu,%llu,%lu,%lu,%lu,%.3f,%.3f,%.3f,%u,%u,%u,%u,%.2f,%.2f,%u,%u,%u,%.2f,%u,%u,%u,%u,%u,%u,%u,%u,%u,%u,%llu,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%.5f,%u,%lu,%u,%lu,%.5f,%.5f,%.5f,%ld,%d,%.3f,%ld,%d,%u,%lu,%lu,%lu,%lu\n",
    (unsigned long)r.ppgDiag.sessionId,(unsigned long)r.ppg.sequence,
    (unsigned long long)r.ppg.sampleTimeUs,(unsigned long)r.processingUs,
    (unsigned long)r.ppg.red,(unsigned long)r.ppg.ir,r.irDc,r.irAc,r.irFiltered,
    (r.peaks&PEAK_CUSTOM)?1:0,(r.peaks&PEAK_SPARKFUN)?1:0,(r.peaks&PEAK_ACCEPTED)?1:0,
    (unsigned)r.ibiMs,r.bpmInstant,r.hr.bpm,(unsigned)r.hr.status,
    (unsigned)r.hr.quality,(unsigned)r.hr.qualityReasons,r.spo2.spo2Estimate,
    (unsigned)r.spo2.status,(unsigned)r.spo2.quality,(unsigned)r.ppgDiag.ledAmplitude,
    (unsigned)r.ppgDiag.lastCheckCount,(unsigned)r.ppgDiag.lastAvailable,
    (unsigned)r.ppgDiag.hwReadPointer,(unsigned)r.ppgDiag.hwWritePointer,
    (unsigned)r.ppgDiag.hwOverflowCounter,(unsigned)r.ppgDiag.suspectedSoftwareDrops,
    r.ppgDiag.missingSamplesInWindow?1:0,(unsigned long long)r.motion.timestampUs,
    axG,ayG,azG,r.motion.accelerationMagnitudeG,
    r.motion.gxRadS,r.motion.gyRadS,r.motion.gzRadS,r.motion.gyroMagnitudeRadS,
    r.motionWindow.peakG,r.motionWindow.peakDeltaG,
    r.motionWindow.peakGyroRadS,(unsigned)r.motionWindow.samples,
    (unsigned long)r.motion.dtUs,mpuSaturated?1:0,
    (unsigned long)r.motionDiag.missedDeadlines,
    r.ppgDiag.modulationIndexIR,r.ppgDiag.modulationIndexRed,r.ppgDiag.ratioR,
    (long)r.ppgDiag.maximSpo2,(int)r.ppgDiag.maximSpo2Valid,
    r.ppgDiag.researchSpo2Candidate,(long)r.ppgDiag.maximHeartRate,
    (int)r.ppgDiag.maximHeartRateValid,
    (unsigned)r.session,(unsigned long)r.loopLastUs,(unsigned long)r.loopMaxUs,
    (unsigned long)r.displayRenderUs,(unsigned long)r.i2cFailures);
  if(txLen>=sizeof(tx))txLen=sizeof(tx)-1;txPos=0;
}
}
#endif

namespace BioResearch {
// [BIOSYS-I3] API compilable a costo casi nulo cuando BIO_RESEARCH_MODE=0.
void begin(){
#if BIO_RESEARCH_MODE
  Serial.println(F("type,session_id,sample_index,sample_time_us,processing_time_us,red_raw,ir_raw,ir_dc,ir_ac,ir_filtered,peak_custom,peak_sparkfun,peak_accepted,ibi_ms,bpm_instant,bpm_robust,hr_status,ppg_quality,ppg_quality_flags,spo2_result,spo2_status,spo2_quality,led_amplitude,sparkfun_check_count,sparkfun_available,hw_fifo_read_ptr,hw_fifo_write_ptr,hw_fifo_overflow,suspected_drops,missing_samples,mpu_time_us,ax_g,ay_g,az_g,acc_mag_g,gx_rad_s,gy_rad_s,gz_rad_s,gyro_mag_rad_s,mpu_window_peak_g,mpu_window_delta_g,mpu_window_gyro_rad_s,mpu_window_samples,mpu_dt_us,mpu_saturated,mpu_missed_deadlines,ppg_mod_ir_pct,ppg_mod_red_pct,ppg_ratio_r,spo2_maxim,spo2_maxim_valid,spo2_custom_candidate,maxim_hr,maxim_hr_valid,measurement_state,loop_last_us,loop_max_us,display_render_us,i2c_failures"));
#endif
}

void logPPG(const PPGSample&s,float dc,float ac,float filtered,uint8_t peaks,
            uint16_t ibi,float bpmInstant,const HeartRateResult&hr,
            const SpO2Result&spo2,const PPGDiagnostics&diag,
            MeasurementSessionState session,uint32_t processingUs){
#if BIO_RESEARCH_MODE
  Record record={s,dc,ac,filtered,peaks,ibi,bpmInstant,hr,spo2,diag,session,
    MotionService::latest(),MotionService::diagnostics(),
    MotionService::consumeResearchWindow(),processingUs,
    runtimeMetrics.loopLastUs,runtimeMetrics.loopMaxUs,
    runtimeMetrics.displayRenderLastUs,systemHealth.i2cErrors};
  enqueue(record);
#else
  (void)s;(void)dc;(void)ac;(void)filtered;(void)peaks;(void)ibi;(void)bpmInstant;
  (void)hr;(void)spo2;(void)diag;(void)session;(void)processingUs;
#endif
}

void update(){
#if BIO_RESEARCH_MODE
  buildLine();if(txPos>=txLen)return;
  // Una sola escritura mantiene el mutex UART durante todo el registro. Así
  // los mensajes Wi-Fi/telemetría del otro núcleo no parten una fila CSV.
  Serial.write((const uint8_t*)tx+txPos,txLen-txPos);txPos=txLen;
  if(txPos>=txLen){txPos=txLen=0;buildLine();}
#endif
}

uint32_t droppedRecords(){
#if BIO_RESEARCH_MODE
  return dropped;
#else
  return 0;
#endif
}
}
