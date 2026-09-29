#ifndef VITALWATCH_PPG_COMPARISON_DIAGNOSTIC_H
#define VITALWATCH_PPG_COMPARISON_DIAGNOSTIC_H

#include "Sensor_Oxigeno.h"
#include "Sensor_Movimiento.h"
#include "SystemState.h"
#include "FreezeTrace.h"

// HRPAIR-1: called on the sensor-owning loop core. Copy BEFORE serial output.
// Read-only snapshots; no detector reset, no new medical thresholds.
static inline void printPpgComparisonSnapshot() {
  FreezeTrace::Scope trace(FreezeTrace::HRPAIR_WRITE);
  const HeartRateResult instant = PPGService::heartRateInstant();
  const HeartRateResult display = PPGService::heartRate();
  const PPGDiagnostics diag = PPGService::diagnostics();
  const PPGSample sample = PPGService::latestSample();
  const RuntimeMetrics metrics = runtimeMetrics;
  const bool imuValid = MotionService::latest().valid;
  const uint64_t nowUs = (uint64_t)esp_timer_get_time();
  // One bounded line and one write avoid fragments interleaving with network logs.
  char line[512];
  const int length = snprintf(line, sizeof(line),
    "HRPAIR,1,%llu,%lu,%lu,%u,%u,%.2f,%u,%llu,%u,%.2f,%u,%llu,"
    "%u,%u,%.4f,%u,%u,%.3f,%.3f,%lu,%u,%lu,%u,%lu,%lu,%u\n",
    (unsigned long long)nowUs, (unsigned long)diag.sessionId,
    (unsigned long)sample.sequence, (unsigned)diag.contact,
    (unsigned)instant.status, instant.bpm, (unsigned)instant.qualityReasons,
    (unsigned long long)instant.timestampUs,
    (unsigned)display.status, display.bpm, (unsigned)display.qualityReasons,
    (unsigned long long)display.timestampUs,
    (unsigned)diag.ibiCount, (unsigned)diag.ibiRangeMs, diag.ibiMadRatio,
    (unsigned)diag.synchronizedCount, (unsigned)diag.synchronizationWindowSize,
    diag.redSnr, diag.irSnr, (unsigned long)diag.timingInvalidSamples,
    (unsigned)diag.missingSamplesInWindow, (unsigned long)diag.suspectedSoftwareDrops,
    (unsigned)diag.hwOverflowCounter, (unsigned long)metrics.ppgServiceGapUs,
    (unsigned long)metrics.ppgServiceGapMaxUs, (unsigned)imuValid);
  if (length > 0 && (size_t)length < sizeof(line)) {
    Serial.write((const uint8_t*)line, (size_t)length);
  } else {
    Serial.println(F("[DIAG][HRPAIR] FORMAT_ERROR"));
  }
}
#endif
