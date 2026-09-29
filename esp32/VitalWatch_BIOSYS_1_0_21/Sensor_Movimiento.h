#ifndef VITALWATCH_SENSOR_MOVIMIENTO_H
#define VITALWATCH_SENSOR_MOVIMIENTO_H

#include <Arduino.h>

/*
  ============================================================================
  MOTION SERVICE — MPU6050 / variantes detectables
  ============================================================================

  RESPONSABILIDAD
  - configurar y leer el IMU;
  - publicar MotionSample;
  - medir dt/jitter/deadlines;
  - detectar saturacion;
  - producir un evento semantico POSSIBLE_IMPACT.

  NO RESPONSABILIDAD
  - NO decide que pantalla mostrar;
  - NO activa directamente la alerta grafica;
  - NO afirma "caida confirmada";
  - NO retunea thresholds en 0.6.0.
*/

enum class MotionHardwareStatus : uint8_t {
  NOT_FOUND=0,
  MPU6050_VALIDATED_TARGET,
  UNVALIDATED_HARDWARE_VARIANT,
  READ_ERROR
};

struct MotionSample {
  float axMs2, ayMs2, azMs2;
  float gxRadS, gyRadS, gzRadS;
  float accelerationMagnitudeG;
  float accelerationDeltaG; // NO es jerk: falta dividir por delta de tiempo.
  float gyroMagnitudeRadS;
  uint64_t timestampUs;
  uint32_t dtUs;
  int32_t jitterUs;
  bool accelSaturated;
  bool gyroSaturated;
  bool valid;
};

// Maximos observados entre dos filas PPG. Permite conservar impactos breves
// del MPU a 100 Hz aunque el CSV combinado se escriba a unos 25 Hz.
struct MotionResearchWindow {
  float peakG;
  float peakDeltaG;
  float peakGyroRadS;
  uint16_t samples;
};

struct PossibleImpactEvent {
  bool pending;
  uint64_t timestampUs;
  float peakG;
  float deltaG;
  float gyroRadS;
};

struct MotionDiagnostics {
  uint32_t samples;
  uint32_t missedDeadlines;
  uint32_t readErrors;
  uint32_t accelSaturationCount;
  uint32_t gyroSaturationCount;
  uint32_t maxDtUs;
  uint32_t maxAbsJitterUs;
  uint8_t whoAmI;
  uint8_t i2cAddress;
  MotionHardwareStatus hardwareStatus;
  char model[20];
  char error[28];
};

namespace MotionService {
  void begin();
  void update();
  void forceReconnect();
  void diagnoseAndReconnect();
  bool revalidate();
  bool isReady();
  const MotionSample& latest();
  const MotionDiagnostics& diagnostics();
  MotionResearchWindow consumeResearchWindow();
  bool consumePossibleImpact(PossibleImpactEvent &event);
  void rearmImpactDemo();
}

#endif
