#ifndef VITALWATCH_TELEMETRIA_H
#define VITALWATCH_TELEMETRIA_H

#include <Arduino.h>

// Captura una fotografia pequena del estado de los sensores y la coloca en la
// cola de red. La solicitud HTTPS ocurre en el otro nucleo, junto con la
// sincronizacion de medicamentos, para no frenar el muestreo del MAX30102/MPU.
namespace TelemetriaConfig {
  static constexpr uint32_t INTERVALO_ENVIO_MS = 30000UL;
  static constexpr uint32_t EDAD_MAXIMA_SIGNOS_VITALES_MS = 60000UL;
  static constexpr uint8_t MUESTRAS_BATERIA = 8;
  static constexpr uint8_t UMBRAL_MODO_RENDIMIENTO = 20;
}

static uint32_t ultimaTelemetriaSolicitada = 0;

static inline bool leerBateriaReal(int16_t &porcentaje) {
  porcentaje = 0;
  const int8_t pin = VitalWatchConfig::PIN_BATERIA_ADC;
  if (pin < 0) return false;

  uint32_t sumaMilivoltios = 0;
  for (uint8_t muestra = 0; muestra < TelemetriaConfig::MUESTRAS_BATERIA; ++muestra) {
    sumaMilivoltios += analogReadMilliVolts(pin);
  }

  const float voltajePin =
    (sumaMilivoltios / (float)TelemetriaConfig::MUESTRAS_BATERIA) / 1000.0f;
  const float voltajeBateria =
    voltajePin * VitalWatchConfig::FACTOR_DIVISOR_BATERIA;
  const float rango =
    VitalWatchConfig::VOLTAJE_BATERIA_LLENA -
    VitalWatchConfig::VOLTAJE_BATERIA_VACIA;

  if (rango <= 0.0f || voltajeBateria < 2.5f || voltajeBateria > 5.0f) {
    return false;
  }

  const float proporcion =
    (voltajeBateria - VitalWatchConfig::VOLTAJE_BATERIA_VACIA) / rango;
  porcentaje = (int16_t)constrain((int)lroundf(proporcion * 100.0f), 0, 100);
  return true;
}

static inline TelemetriaVitalWatch crearTelemetriaActual(
  TipoEventoTelemetria evento = TipoEventoTelemetria::NINGUNO,
  float impactoEventoG = -1.0f
) {
  TelemetriaVitalWatch telemetria = {};
  const uint32_t ahora = millis();
  const bool signosRecientes =
    ultimoResultadoVital.timestampMs != 0 &&
    ahora - ultimoResultadoVital.timestampMs <=
      TelemetriaConfig::EDAD_MAXIMA_SIGNOS_VITALES_MS;

  telemetria.frecuenciaValida =
    signosRecientes && ultimoResultadoVital.bpmValido;
  telemetria.frecuenciaCardiaca = telemetria.frecuenciaValida
    ? (int16_t)ultimoResultadoVital.bpm
    : 0;

  telemetria.spo2Valido = signosRecientes && ultimoResultadoVital.spo2Valido;
  telemetria.spo2 = telemetria.spo2Valido
    ? (int16_t)ultimoResultadoVital.spo2
    : 0;

  telemetria.bateriaValida = leerBateriaReal(telemetria.bateria);
  telemetria.modoRendimiento =
    telemetria.bateriaValida &&
    telemetria.bateria <= TelemetriaConfig::UMBRAL_MODO_RENDIMIENTO;

  if (impactoEventoG >= 0.0f) {
    telemetria.impactoValido = true;
    telemetria.impactoG = impactoEventoG;
  } else {
    telemetria.impactoValido = movimientoActual.valida;
    telemetria.impactoG = movimientoActual.valida
      ? movimientoActual.magnitudAceleracionG
      : 0.0f;
  }

  telemetria.evento = evento;
  return telemetria;
}

static inline bool encolarTelemetriaActual(
  TipoEventoTelemetria evento = TipoEventoTelemetria::NINGUNO,
  float impactoEventoG = -1.0f
) {
  const TelemetriaVitalWatch telemetria =
    crearTelemetriaActual(evento, impactoEventoG);

  if (telemetria.bateriaValida) {
    establecerBateria(telemetria.bateria);
  }

  if (!solicitarEnvioTelemetria(telemetria)) {
    Serial.println(F("[ERROR][TEL] Cola de red ocupada"));
    return false;
  }

  return true;
}

static inline void inicializarTelemetria() {
  if (VitalWatchConfig::PIN_BATERIA_ADC >= 0) {
    pinMode(VitalWatchConfig::PIN_BATERIA_ADC, INPUT);
    analogSetPinAttenuation(VitalWatchConfig::PIN_BATERIA_ADC, ADC_11db);
    Serial.println(F("[INFO][BAT] Lectura ADC habilitada"));
  } else {
    Serial.println(F("[INFO][BAT] Sin circuito ADC; bateria no se inventa"));
  }
}

static inline void procesarTelemetriaPeriodica() {
  const uint32_t ahora = millis();
  if (ultimaTelemetriaSolicitada != 0 &&
      ahora - ultimaTelemetriaSolicitada < TelemetriaConfig::INTERVALO_ENVIO_MS) {
    return;
  }

  ultimaTelemetriaSolicitada = ahora;
  encolarTelemetriaActual();
}

static inline void notificarCaidaTelemetria(float impactoG) {
  encolarTelemetriaActual(TipoEventoTelemetria::CAIDA, impactoG);
}

static inline void notificarSosTelemetria() {
  encolarTelemetriaActual(TipoEventoTelemetria::SOS);
}

#endif
