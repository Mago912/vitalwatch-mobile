#ifndef VITALWATCH_BIO_RESEARCH_H
#define VITALWATCH_BIO_RESEARCH_H

#include <Arduino.h>
#include "Sensor_Oxigeno.h"
#include "Sensor_Movimiento.h"

/*
  Logger CSV no bloqueante por cola + envio fragmentado.
  BIO_RESEARCH_MODE=0 elimina casi todo el costo de ejecucion normal.
*/
namespace BioResearch {
  void begin();
  void update();
  void logPPG(const PPGSample &s, float irDc, float irAc, float irFiltered,
              uint8_t peakBits, uint16_t ibiMs, float bpmInstant,
              const HeartRateResult &hr, const SpO2Result &spo2,
              const PPGDiagnostics &diag, MeasurementSessionState session,
              uint32_t processingTimeUs);
  uint32_t droppedRecords();
}

#endif
