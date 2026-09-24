#ifndef VITALWATCH_SENSOR_OXIGENO_H
#define VITALWATCH_SENSOR_OXIGENO_H

#include <Arduino.h>
#include "Configuracion.h"

/*
  ============================================================================
  PPG SERVICE — MAX30102 / SparkFun MAX3010x
  ============================================================================

  PRINCIPIOS DE 0.6.0
  ------------------
  1) Adquisicion, algoritmos y UI quedan desacoplados.
  2) Cada muestra recibe sequence + timestamp reconstruido coherente.
  3) Se observa el doble FIFO (hardware + buffer software SparkFun).
  4) Custom peak y SparkFun peak se registran por separado.
  5) Un solo IBI NO se marca como resultado HR VALID.
  6) SpO2 entra al result path solo si MaximValid AND quality suficiente.
  7) El fallback 110-25R queda solo como dato de research.
  8) Los estados NO se representan con bpm=0/spo2=0.

  NOTA: los timestamps del MAX30102 NO son nativos del sensor. Se reconstruyen
  a partir de la tasa efectiva baseline (~100 registros FIFO/s: 400/AVG4).
*/

enum class HeartRateStatus : uint8_t {
  VALID=0,
  INSUFFICIENT_DATA,
  UNSTABLE,
  LOW_QUALITY,
  NO_CONTACT,
  TIMING_INVALID,
  SENSOR_ERROR
};

enum class SpO2Status : uint8_t {
  EXPERIMENTAL_VALID=0,
  INVALID,
  LOW_QUALITY,
  NO_CONTACT,
  INSUFFICIENT_DATA,
  SENSOR_ERROR
};

enum class MeasurementSessionState : uint8_t {
  WAITING_CONTACT=0,
  STABILIZING,
  MEASURING,
  RESULT_READY,
  LOW_QUALITY,
  CANCELLED,
  TIMEOUT,
  SENSOR_ERROR
};

enum PeakSource : uint8_t {
  PEAK_NONE=0,
  PEAK_CUSTOM=1u<<0,
  PEAK_SPARKFUN=1u<<1,
  PEAK_ACCEPTED=1u<<2
};

struct HeartRateResult {
  float bpm;
  HeartRateStatus status;
  SignalQuality quality;
  uint16_t qualityReasons;
  uint64_t timestampUs;
  uint16_t algorithmVersion;
};

struct SpO2Result {
  float spo2Estimate;
  SpO2Status status;
  SignalQuality quality;
  uint16_t qualityReasons;
  uint64_t timestampUs;
  uint16_t algorithmVersion;
  uint16_t calibrationVersion;
};

struct PPGSample {
  uint32_t red;
  uint32_t ir;
  uint32_t sequence;
  uint64_t sampleTimeUs;
  bool timingValid;
};

struct PPGDiagnostics {
  uint32_t sessionId;
  uint32_t samplesProcessed;
  uint32_t checkSamplesTotal;
  uint32_t suspectedSoftwareDrops;
  uint32_t timingInvalidSamples;
  uint32_t maxServiceGapUs;
  uint16_t lastCheckCount;
  uint8_t lastAvailable;
  uint8_t hwReadPointer;
  uint8_t hwWritePointer;
  uint8_t hwOverflowCounter;
  uint8_t ledAmplitude;
  uint8_t partId;
  bool contact;
  bool missingSamplesInWindow;
  float modulationIndexIR;
  float modulationIndexRed;
  float ratioR;
  int32_t maximSpo2;
  int8_t maximSpo2Valid;
  int32_t maximHeartRate;
  int8_t maximHeartRateValid;
  float researchSpo2Candidate;
  char error[28];
};

namespace PPGService {
  void begin();
  void update();
  void forceReconnect();
  bool isReady();
  MeasurementSessionState sessionState();
  const HeartRateResult& heartRate();
  const HeartRateResult& heartRateForTelemetry();
  const SpO2Result& spo2();
  const PPGDiagnostics& diagnostics();
  const PPGSample& latestSample();

  // Camino offline/replay: procesa una muestra ya temporalizada sin tocar I2C.
  // El mismo pipeline de filtros/peaks/resultados se reutiliza para comparar
  // datasets entre versiones.
  void resetReplay();
  void processReplaySample(const PPGSample &sample);
}

const char* nombreEstadoHR(HeartRateStatus s);
const char* nombreEstadoSpO2(SpO2Status s);
const char* nombreSesionPPG(MeasurementSessionState s);

#endif
