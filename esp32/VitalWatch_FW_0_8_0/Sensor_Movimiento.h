#ifndef VITALWATCH_SENSOR_MOVIMIENTO_H
#define VITALWATCH_SENSOR_MOVIMIENTO_H

#include <Arduino.h>
#include <math.h>
#include "Configuracion.h"

// ============================================================================
// SENSOR DE MOVIMIENTO - MPU60xx / MPU65xx COMPATIBLE
//
// Se accede por registros comunes para aceptar modulos que se venden como
// "MPU6050" pero reportan WHO_AM_I de MPU6500/MPU9250.
//
// IMPORTANTE: los umbrales de impacto de esta revision son EXPERIMENTALES y
// estan orientados a demostracion. No equivalen a una validacion de caidas.
// El significado biometrico final pertenece a Biomedical Algorithms Lab.
// ============================================================================
namespace MovimientoConfig {
  static constexpr uint8_t DIRECCION_1 = 0x68;
  static constexpr uint8_t DIRECCION_2 = 0x69;

  static constexpr uint8_t REG_SMPLRT_DIV   = 0x19;
  static constexpr uint8_t REG_CONFIG       = 0x1A;
  static constexpr uint8_t REG_GYRO_CONFIG  = 0x1B;
  static constexpr uint8_t REG_ACCEL_CONFIG = 0x1C;
  static constexpr uint8_t REG_ACCEL_XOUT_H = 0x3B;
  static constexpr uint8_t REG_PWR_MGMT_1   = 0x6B;
  static constexpr uint8_t REG_PWR_MGMT_2   = 0x6C;
  static constexpr uint8_t REG_WHO_AM_I     = 0x75;

  static constexpr uint8_t ID_MPU6050 = 0x68;
  static constexpr uint8_t ID_MPU6500 = 0x70;
  static constexpr uint8_t ID_MPU9250 = 0x71;
  static constexpr uint8_t ID_MPU9255 = 0x73;

  // Rangos configurados: acelerometro +/-8 g, giroscopio +/-500 deg/s.
  static constexpr float ACEL_LSB_POR_G = 4096.0f;
  static constexpr float GIRO_LSB_POR_DPS = 65.5f;
  static constexpr float GRAVEDAD_MS2 = 9.80665f;
  static constexpr float DEG_A_RAD = 0.01745329252f;

  // Umbrales EXPERIMENTALES de demostracion.
  static constexpr float UMBRAL_IMPACTO_FUERTE_G = 1.70f;
  static constexpr float UMBRAL_IMPACTO_MODERADO_G = 1.32f;
  static constexpr float UMBRAL_VARIACION_G = 0.48f;
  static constexpr float UMBRAL_GIRO_RAD_S = 1.15f;
  static constexpr float UMBRAL_GIRO_VARIACION_RAD_S = 0.70f;

  static constexpr uint32_t INTERVALO_LECTURA_MS = 10UL;      // objetivo 100 Hz
  static constexpr uint32_t INTERVALO_RECONEXION_MS = 3000UL;
  static constexpr uint32_t INTERVALO_REFRESCO_VISTA_MS = 200UL;
  static constexpr uint32_t BLOQUEO_NUEVO_IMPACTO_MS = 1400UL;
  static constexpr uint8_t MAX_ERRORES_CONSECUTIVOS = 4;
}

struct MuestraMovimiento {
  float axMs2;
  float ayMs2;
  float azMs2;
  float gxRadS;
  float gyRadS;
  float gzRadS;
  float magnitudAceleracionG;
  float variacionAceleracionG;
  float magnitudGiroRadS;
  uint32_t timestampMs;
  bool valida;
};

static uint8_t direccionMPUActiva = 0;
static uint8_t whoAmIMPU = 0;
static const char* modeloMPU = "NO DETECTADO";
static char detalleErrorMPU[24] = "NO PROBADO";

static uint32_t ultimaLecturaMPU = 0;
static uint32_t ultimoIntentoReconexionMPU = 0;
static uint32_t ultimoRefrescoVistaMovimiento = 0;
static uint32_t ultimoImpacto = 0;
static uint8_t erroresConsecutivosMPU = 0;
static bool impactoPendiente = false;

static MuestraMovimiento movimientoActual = {
  0, 0, 0, 0, 0, 0,
  0, 0, 0,
  0,
  false
};

static float magnitudAceleracionGAnterior = 1.0f;
static float picoImpactoG = 0.0f;
static float picoImpactoGiro = 0.0f;

static inline void establecerErrorMPU(const char* texto) {
  snprintf(detalleErrorMPU, sizeof(detalleErrorMPU), "%s", texto);
}

static inline bool idMPUCompatible(uint8_t id) {
  using namespace MovimientoConfig;
  return id == ID_MPU6050 || id == ID_MPU6500 ||
         id == ID_MPU9250 || id == ID_MPU9255;
}

static inline const char* nombreModeloMPU(uint8_t id) {
  using namespace MovimientoConfig;
  switch (id) {
    case ID_MPU6050: return "MPU6050";
    case ID_MPU6500: return "MPU6500";
    case ID_MPU9250: return "MPU9250";
    case ID_MPU9255: return "MPU9255";
    default:         return "MPU DESCONOCIDO";
  }
}

static inline bool escribirRegistroMPU(
  uint8_t direccion,
  uint8_t registro,
  uint8_t valor
) {
  Wire.beginTransmission(direccion);
  Wire.write(registro);
  Wire.write(valor);
  return Wire.endTransmission(true) == 0;
}

static inline bool leerBloqueMPU(
  uint8_t direccion,
  uint8_t registroInicial,
  uint8_t* destino,
  size_t longitud
) {
  Wire.beginTransmission(direccion);
  Wire.write(registroInicial);

  if (Wire.endTransmission(false) != 0) return false;

  const size_t recibidos = Wire.requestFrom(direccion, longitud, true);
  if (recibidos != longitud) {
    while (Wire.available()) Wire.read();
    return false;
  }

  for (size_t i = 0; i < longitud; ++i) {
    destino[i] = Wire.read();
  }
  return true;
}

static inline int16_t combinarInt16(uint8_t alto, uint8_t bajo) {
  return (int16_t)(((uint16_t)alto << 8) | bajo);
}

static inline bool leerDatosMPU() {
  using namespace MovimientoConfig;

  if (!mpuDisponible || direccionMPUActiva == 0) return false;

  uint8_t datos[14];
  if (!leerBloqueMPU(
        direccionMPUActiva,
        REG_ACCEL_XOUT_H,
        datos,
        sizeof(datos)
      )) {
    return false;
  }

  const int16_t rawAccX  = combinarInt16(datos[0],  datos[1]);
  const int16_t rawAccY  = combinarInt16(datos[2],  datos[3]);
  const int16_t rawAccZ  = combinarInt16(datos[4],  datos[5]);
  const int16_t rawGiroX = combinarInt16(datos[8],  datos[9]);
  const int16_t rawGiroY = combinarInt16(datos[10], datos[11]);
  const int16_t rawGiroZ = combinarInt16(datos[12], datos[13]);

  movimientoActual.axMs2 = (rawAccX / ACEL_LSB_POR_G) * GRAVEDAD_MS2;
  movimientoActual.ayMs2 = (rawAccY / ACEL_LSB_POR_G) * GRAVEDAD_MS2;
  movimientoActual.azMs2 = (rawAccZ / ACEL_LSB_POR_G) * GRAVEDAD_MS2;

  movimientoActual.gxRadS = (rawGiroX / GIRO_LSB_POR_DPS) * DEG_A_RAD;
  movimientoActual.gyRadS = (rawGiroY / GIRO_LSB_POR_DPS) * DEG_A_RAD;
  movimientoActual.gzRadS = (rawGiroZ / GIRO_LSB_POR_DPS) * DEG_A_RAD;

  const float magnitudMs2 = sqrtf(
    movimientoActual.axMs2 * movimientoActual.axMs2 +
    movimientoActual.ayMs2 * movimientoActual.ayMs2 +
    movimientoActual.azMs2 * movimientoActual.azMs2
  );

  movimientoActual.magnitudGiroRadS = sqrtf(
    movimientoActual.gxRadS * movimientoActual.gxRadS +
    movimientoActual.gyRadS * movimientoActual.gyRadS +
    movimientoActual.gzRadS * movimientoActual.gzRadS
  );

  movimientoActual.magnitudAceleracionG = magnitudMs2 / GRAVEDAD_MS2;
  movimientoActual.variacionAceleracionG = fabsf(
    movimientoActual.magnitudAceleracionG - magnitudAceleracionGAnterior
  );

  magnitudAceleracionGAnterior = movimientoActual.magnitudAceleracionG;
  movimientoActual.timestampMs = millis();
  movimientoActual.valida = true;
  return true;
}

static inline bool configurarMPUCompatible(uint8_t direccion) {
  using namespace MovimientoConfig;

  // Los delays siguientes ocurren solo durante inicializacion/reconexion.
  // No forman parte del camino continuo de muestreo.
  if (!escribirRegistroMPU(direccion, REG_PWR_MGMT_1, 0x80)) {
    establecerErrorMPU("RESET I2C");
    return false;
  }
  delay(100);

  if (!escribirRegistroMPU(direccion, REG_PWR_MGMT_1, 0x01) ||
      !escribirRegistroMPU(direccion, REG_PWR_MGMT_2, 0x00)) {
    establecerErrorMPU("PWR CONFIG");
    return false;
  }

  // DLPF + rangos. Con SMPLRT_DIV=9 se busca ~100 Hz de lectura.
  if (!escribirRegistroMPU(direccion, REG_SMPLRT_DIV, 9) ||
      !escribirRegistroMPU(direccion, REG_CONFIG, 0x04) ||
      !escribirRegistroMPU(direccion, REG_GYRO_CONFIG, 0x08) ||
      !escribirRegistroMPU(direccion, REG_ACCEL_CONFIG, 0x10)) {
    establecerErrorMPU("RANGO CONFIG");
    return false;
  }

  delay(30);
  return true;
}

static inline bool probarDireccionMPU(uint8_t direccion) {
  using namespace MovimientoConfig;

  if (!direccionI2CResponde(direccion)) return false;

  uint8_t id = 0;
  if (!leerRegistroI2C(direccion, REG_WHO_AM_I, id)) {
    establecerErrorMPU("SIN WHO_AM_I");
    return false;
  }

  whoAmIMPU = id;
  modeloMPU = nombreModeloMPU(id);

  if (!idMPUCompatible(id)) {
    snprintf(detalleErrorMPU, sizeof(detalleErrorMPU), "ID 0x%02X", id);
    return false;
  }

  direccionMPUActiva = direccion;
  if (!configurarMPUCompatible(direccion)) {
    direccionMPUActiva = 0;
    return false;
  }

  mpuDisponible = true;
  if (!leerDatosMPU()) {
    mpuDisponible = false;
    direccionMPUActiva = 0;
    establecerErrorMPU("LECTURA FALLO");
    return false;
  }

  erroresConsecutivosMPU = 0;
  establecerErrorMPU("OK");

  Serial.print(F("[INFO][IMU] "));
  Serial.print(modeloMPU);
  Serial.print(F(" 0x"));
  Serial.print(direccionMPUActiva, HEX);
  Serial.print(F(" WHO_AM_I=0x"));
  Serial.println(whoAmIMPU, HEX);
  return true;
}

static inline bool intentarConexionMPU() {
  using namespace MovimientoConfig;

  mpuDisponible = false;
  movimientoActual.valida = false;
  direccionMPUActiva = 0;
  whoAmIMPU = 0;
  modeloMPU = "NO DETECTADO";
  establecerErrorMPU("SIN ACK");

  if (probarDireccionMPU(DIRECCION_1)) return true;
  if (probarDireccionMPU(DIRECCION_2)) return true;

  Serial.print(F("[WARN][IMU] No disponible: "));
  Serial.println(detalleErrorMPU);
  return false;
}

static inline void inicializarMPU() {
  ultimaLecturaMPU = millis();
  ultimoIntentoReconexionMPU = millis();
  intentarConexionMPU();
  pantallaSucia = true;
}

static inline void declararMPUDesconectado(const char* motivo) {
  mpuDisponible = false;
  movimientoActual.valida = false;
  direccionMPUActiva = 0;
  erroresConsecutivosMPU = 0;
  establecerErrorMPU(motivo);
  pantallaSucia = true;

  Serial.print(F("[ERROR][IMU] Desconectado: "));
  Serial.println(motivo);
}

static inline void gestionarReconexionMPU(bool forzar = false) {
  using namespace MovimientoConfig;

  const uint32_t ahora = millis();
  if (!forzar && ahora - ultimoIntentoReconexionMPU < INTERVALO_RECONEXION_MS) {
    return;
  }

  ultimoIntentoReconexionMPU = ahora;
  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
  Wire.setTimeOut(VitalWatchConfig::TIMEOUT_I2C_MS);
  intentarConexionMPU();
}

static inline void forzarReconexionMPU() {
  ultimoIntentoReconexionMPU = 0;
  gestionarReconexionMPU(true);
}

static inline bool revalidarMPU() {
  using namespace MovimientoConfig;

  if (!mpuDisponible || direccionMPUActiva == 0) return false;

  uint8_t id = 0;
  if (!direccionI2CResponde(direccionMPUActiva) ||
      !leerRegistroI2C(direccionMPUActiva, REG_WHO_AM_I, id) ||
      !idMPUCompatible(id)) {
    declararMPUDesconectado("POST BUS I2C");
    return false;
  }

  whoAmIMPU = id;
  modeloMPU = nombreModeloMPU(id);

  if (!leerDatosMPU()) {
    declararMPUDesconectado("POST MAX30102");
    return false;
  }

  return true;
}

static inline bool consumirImpactoPendiente() {
  if (!impactoPendiente) return false;
  impactoPendiente = false;
  return true;
}

// Funcion cooperativa: se llama en cada loop, pero solo accede al sensor cuando
// vence su periodo. No contiene esperas deliberadas en operacion normal.
static inline void procesarMovimiento() {
  using namespace MovimientoConfig;

  if (!mpuDisponible) {
    gestionarReconexionMPU();
    return;
  }

  const uint32_t ahora = millis();
  if (ahora - ultimaLecturaMPU < INTERVALO_LECTURA_MS) return;
  ultimaLecturaMPU = ahora;

  if (!leerDatosMPU()) {
    ++erroresConsecutivosMPU;
    if (erroresConsecutivosMPU >= MAX_ERRORES_CONSECUTIVOS) {
      declararMPUDesconectado("LECTURA I2C");
    }
    return;
  }

  erroresConsecutivosMPU = 0;

  const bool impactoFuerte =
    movimientoActual.magnitudAceleracionG >= UMBRAL_IMPACTO_FUERTE_G;

  const bool impactoConRotacion =
    movimientoActual.magnitudAceleracionG >= UMBRAL_IMPACTO_MODERADO_G &&
    movimientoActual.magnitudGiroRadS >= UMBRAL_GIRO_RAD_S;

  const bool cambioBruscoConRotacion =
    movimientoActual.variacionAceleracionG >= UMBRAL_VARIACION_G &&
    movimientoActual.magnitudGiroRadS >= UMBRAL_GIRO_VARIACION_RAD_S;

  if (!alertaImpactoActiva &&
      ahora - ultimoImpacto >= BLOQUEO_NUEVO_IMPACTO_MS &&
      (impactoFuerte || impactoConRotacion || cambioBruscoConRotacion)) {

    ultimoImpacto = ahora;
    impactoPendiente = true;
    picoImpactoG = movimientoActual.magnitudAceleracionG;
    picoImpactoGiro = movimientoActual.magnitudGiroRadS;

    Serial.print(F("[EVENT][IMU] Posible impacto: |a|="));
    Serial.print(picoImpactoG, 2);
    Serial.print(F(" g, delta="));
    Serial.print(movimientoActual.variacionAceleracionG, 2);
    Serial.print(F(" g, giro="));
    Serial.print(picoImpactoGiro, 2);
    Serial.println(F(" rad/s"));
  }

  if (modoActual == ModoSistema::DIAGNOSTICO_MOVIMIENTO &&
      ahora - ultimoRefrescoVistaMovimiento >= INTERVALO_REFRESCO_VISTA_MS) {
    ultimoRefrescoVistaMovimiento = ahora;
    pantallaSucia = true;
  }
}

#endif
