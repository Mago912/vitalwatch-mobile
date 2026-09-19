#ifndef VITALWATCH_CONFIGURACION_H
#define VITALWATCH_CONFIGURACION_H

#include <Arduino.h>

/*
  ============================================================================
  VITALWATCH FW 0.6.0 — CONFIGURACION CENTRAL
  ============================================================================

  OBJETIVO DE ESTE ARCHIVO
  ------------------------
  Este header contiene SOLO constantes, enums y tipos compartidos. A diferencia
  de 0.5.0, NO guarda estado mutable ni crea objetos globales. Esta separacion es
  deliberada: evita que un mismo estado se duplique cuando el proyecto pasa de
  headers monoliticos a archivos .h/.cpp reales.

  REGLA DE CAMBIO
  ---------------
  Los parametros marcados BASELINE provienen de 0.5.0 y NO deben retunearse sin
  dataset y autorizacion del Biomedical Algorithms Lab.
*/

namespace VitalWatchConfig {
  // Versionado de dos ejes. Este sketch es el perfil de validacion biomédica;
  // NO es el firmware de sistema conectado ni debe confundirse con el.
  constexpr const char* FAMILIA_SISTEMA = "VW-SYS";
  constexpr const char* VERSION_SISTEMA_OBJETIVO = "0.9.1";
  constexpr const char* FAMILIA_BIOMEDICA = "VW-BIO";
  constexpr const char* VERSION_BIOMEDICA = "0.6.0";
  constexpr const char* BASELINE_BIOMEDICA = "FW 0.5.0";
  constexpr const char* ROL_BUILD = "BIOMEDICAL_VALIDATION_PROFILE";
  constexpr uint16_t ALGORITHM_VERSION_HR = 0x0600;
  constexpr uint16_t ALGORITHM_VERSION_SPO2 = 0x0600;
  constexpr uint16_t CALIBRATION_VERSION_SPO2 = 0x0001;

  // I2C compartido por MAX30102 + MPU.
  constexpr uint8_t PIN_I2C_SDA = 21;
  constexpr uint8_t PIN_I2C_SCL = 22;
  constexpr uint32_t FRECUENCIA_I2C_HZ = 100000UL; // BASELINE: no subir a 400 kHz aun.
  constexpr uint16_t TIMEOUT_I2C_MS = 100;         // BASELINE: instrumentar antes de reducir.

  // ST7735 1.44" 128x128, SPI hardware del ESP32.
  constexpr uint8_t TFT_CS = 5;
  constexpr uint8_t TFT_DC = 2;
  constexpr uint8_t TFT_RST = 4;
  constexpr uint8_t TFT_MOSI = 23;
  constexpr uint8_t TFT_SCLK = 18;
  constexpr uint8_t ROTACION_TFT = 1;

  // Botones fisicos con INPUT_PULLUP: pulsado = LOW.
  constexpr uint8_t BTN_IZQUIERDA = 25;
  constexpr uint8_t BTN_OK = 26;
  constexpr uint8_t BTN_DERECHA = 27;
  constexpr uint32_t BTN_DEBOUNCE_MS = 35;
  constexpr uint32_t BTN_LONG_OK_MS = 1200;

  // Interfaz.
  constexpr uint32_t DURACION_SPLASH_MS = 2800;
  constexpr uint32_t DURACION_INDICADOR_BOTON_MS = 700;
  constexpr uint32_t INTERVALO_UI_PPG_MS = 500;
  constexpr uint32_t INTERVALO_UI_IMU_MS = 200;
  constexpr uint32_t INTERVALO_UI_ESTADO_MS = 1000;

  // Research. Habilitar temporalmente para capturar CSV; en demo normal dejar 0.
  #ifndef BIO_RESEARCH_MODE
  #define BIO_RESEARCH_MODE 0
  #endif

  // Replay. Permite alimentar las funciones matematicas sin leer hardware.
  #ifndef BIO_REPLAY_MODE
  #define BIO_REPLAY_MODE 0
  #endif
}

// Estados globales de aplicacion. Son semanticos, no pertenecen a un sensor.
enum class ModoSistema : uint8_t {
  SPLASH = 0,
  MENU,
  SIGNOS_VITALES,
  DIAGNOSTICO_MOVIMIENTO,
  ESTADO_SISTEMA,
  ALERTA_IMPACTO
};

// Calidad comun de una senal. No es un score clinico.
enum class SignalQuality : uint8_t {
  GOOD = 0,
  FAIR,
  POOR,
  NO_SIGNAL,
  INVALID
};

// Razones de calidad. Se combinan como bits para conservar mas de una causa.
enum QualityReason : uint16_t {
  QR_NONE              = 0,
  QR_NO_CONTACT        = 1u << 0,
  QR_SATURATED         = 1u << 1,
  QR_LOW_PULSATILITY   = 1u << 2,
  QR_IRREGULAR_PEAKS   = 1u << 3,
  QR_IBI_INCONSISTENT  = 1u << 4,
  QR_TIMING_INVALID    = 1u << 5,
  QR_MISSING_SAMPLES   = 1u << 6,
  QR_HIGH_MOTION       = 1u << 7
};

inline QualityReason operator|(QualityReason a, QualityReason b) {
  return static_cast<QualityReason>(static_cast<uint16_t>(a) | static_cast<uint16_t>(b));
}

#endif
