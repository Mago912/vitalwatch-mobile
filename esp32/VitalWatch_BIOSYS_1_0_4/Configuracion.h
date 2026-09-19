#ifndef VITALWATCH_CONFIGURACION_H
#define VITALWATCH_CONFIGURACION_H

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>

// ============================================================================
// [BIOSYS-A1] VITALWATCH BIOSYS - CONFIGURACION CENTRAL
// Firmware objetivo: ESP32 NodeMCU / ESP32 Dev Module de 38 pines.
// Pantalla: ST7735 1.44" 128x128.
//
// Este archivo concentra pines, tiempos, estados globales simples y utilidades
// de bajo nivel. La idea es evitar numeros "magicos" repartidos por el codigo.
// ============================================================================

namespace VitalWatchConfig {

  // --------------------------------------------------------------------------
  // [BIOSYS-A2] Version compuesta y versiones de sus dos componentes.
  // BIOSYS avanza como producto, mientras SYS y BIO conservan trazabilidad.
  // --------------------------------------------------------------------------
  static constexpr const char* FAMILIA_PRODUCTO = "VW-BIOSYS";
  static constexpr const char* VERSION_PRODUCTO = "1.0.4";
  static constexpr const char* FAMILIA_SISTEMA = "VW-SYS";
  static constexpr const char* VERSION_SISTEMA = "0.9.4";
  static constexpr const char* FAMILIA_BIOMEDICA = "VW-BIO";
  static constexpr const char* VERSION_BIOMEDICA = "0.6.3";
  static constexpr const char* VERSION_FIRMWARE = VERSION_PRODUCTO;
  static constexpr const char* ROL_BUILD = "CONNECTED_BIOMEDICAL_SYSTEM";
  static constexpr uint16_t ALGORITHM_VERSION_HR = 0x0603;
  static constexpr uint16_t ALGORITHM_VERSION_SPO2 = 0x0603;
  static constexpr uint16_t CALIBRATION_VERSION_SPO2 = 0x0001;

  // --------------------------------------------------------------------------
  // I2C compartido por MPU + MAX30102.
  // Estos pines provienen del codigo recibido y NO se modifican en esta version.
  // --------------------------------------------------------------------------
  static constexpr uint8_t PIN_I2C_SDA = 21;
  static constexpr uint8_t PIN_I2C_SCL = 22;
  static constexpr uint32_t FRECUENCIA_I2C_HZ = 100000UL;
  static constexpr uint16_t TIMEOUT_I2C_MS = 100;

  // --------------------------------------------------------------------------
  // TFT ST7735 por SPI.
  // --------------------------------------------------------------------------
  static constexpr uint8_t TFT_CS   = 5;
  static constexpr uint8_t TFT_DC   = 2;
  static constexpr uint8_t TFT_RST  = 4;
  static constexpr uint8_t TFT_MOSI = 23;
  static constexpr uint8_t TFT_SCLK = 18;
  static constexpr uint8_t ROTACION_TFT = 1;

  // Dejar en -1 si el pin LED de la TFT sigue conectado directamente a 3V3.
  // Para apagar tambien la iluminacion, usar un MOSFET o load switch y colocar
  // aqui el GPIO de control. Nunca alimentar el LED directamente desde un GPIO.
  static constexpr int8_t PIN_TFT_BACKLIGHT = -1;
  static constexpr bool TFT_BACKLIGHT_ACTIVO_ALTO = false;

  // --------------------------------------------------------------------------
  // Tiempos generales de interfaz.
  // --------------------------------------------------------------------------
  static constexpr uint32_t DURACION_SPLASH_MS = 2800UL;
  static constexpr uint32_t DURACION_INDICADOR_BOTON_MS = 700UL;
  static constexpr uint32_t INTERVALO_BARRA_ESTADO_MS = 1000UL;
  // La pantalla publica una fotografia robusta de la ventana PPG cada 5 s.
  // La adquisicion del MAX30102 continua sin bloqueo a su tasa efectiva.
  static constexpr uint32_t INTERVALO_UI_PPG_MS = 5000UL;
  static constexpr uint32_t INTERVALO_RESULTADO_PPG_MS = 5000UL;
  static constexpr uint32_t INTERVALO_UI_IMU_MS = 200UL;
  static constexpr uint32_t INTERVALO_UI_ESTADO_MS = 1000UL;

  // --------------------------------------------------------------------------
  // Bateria LiPo opcional.
  // --------------------------------------------------------------------------
  // Un ESP32 Dev Module no puede conocer el porcentaje de bateria por si solo.
  // Para habilitar la lectura real, conecta la bateria mediante un divisor
  // resistivo seguro a un pin ADC1 y reemplaza -1 por ese GPIO. Nunca conectes
  // una LiPo directamente a un GPIO: puede superar el maximo de 3.3 V.
  static constexpr int8_t PIN_BATERIA_ADC = -1;
  static constexpr float FACTOR_DIVISOR_BATERIA = 2.0f;
  static constexpr float VOLTAJE_BATERIA_VACIA = 3.30f;
  static constexpr float VOLTAJE_BATERIA_LLENA = 4.20f;

  // Por seguridad de UX el aviso de impacto NO desaparece solo.
  // El usuario debe pulsar OK para cerrarlo.
  static constexpr bool AUTO_CERRAR_ALERTA = false;
  static constexpr uint32_t DURACION_ALERTA_MS = 10000UL;

  // [BIOSYS-A3] Instrumentacion BIO opcional. El producto normal la desactiva.
  #ifndef BIO_RESEARCH_MODE
    #define BIO_RESEARCH_MODE 0
  #endif
  #ifndef BIO_REPLAY_MODE
    #define BIO_REPLAY_MODE 0
  #endif
}

// [BIOSYS-A4] Calidad semantica compartida por PPG, UI y telemetria.
enum class SignalQuality : uint8_t {
  GOOD = 0,
  FAIR,
  POOR,
  NO_SIGNAL,
  INVALID
};

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
  return static_cast<QualityReason>(
    static_cast<uint16_t>(a) | static_cast<uint16_t>(b)
  );
}

// ============================================================================
// COLORES DE INTERFAZ
// Adafruit usa RGB565. Se mantienen colores simples y de alto contraste.
// ============================================================================
static constexpr uint16_t VW_NEGRO       = ST77XX_BLACK;
static constexpr uint16_t VW_BLANCO      = ST77XX_WHITE;
static constexpr uint16_t VW_CIAN        = ST77XX_CYAN;
static constexpr uint16_t VW_AZUL        = 0x049F;
static constexpr uint16_t VW_AZUL_OSCURO = 0x0128;
static constexpr uint16_t VW_GRIS        = 0x7BEF;
static constexpr uint16_t VW_GRIS_OSCURO = 0x2104;
static constexpr uint16_t VW_VERDE       = ST77XX_GREEN;
static constexpr uint16_t VW_AMARILLO    = ST77XX_YELLOW;
static constexpr uint16_t VW_ROJO        = ST77XX_RED;

// Objeto de pantalla. Se usa un solo propietario global para evitar que cada
// modulo cree su propia instancia del controlador ST7735.
// [BIOSYS-A5] Una sola TFT, definida en SystemState.cpp. Los nuevos .cpp BIO
// incluyen Configuracion.h, por lo que una instancia static aqui se duplicaria.
extern Adafruit_ST7735 tft;

// ============================================================================
// ESTADO GLOBAL DE NAVEGACION
// ============================================================================
enum class ModoSistema : uint8_t {
  SPLASH = 0,
  MENU,
  SIGNOS_VITALES,
  DIAGNOSTICO_MOVIMIENTO,
  ESTADO_SISTEMA,
  MEDICACION,
  CONFIGURACION_WIFI,
  ALERTA_IMPACTO,
  ALERTA_SOS
};

// [BIOSYS-A6] Estado unico definido en SystemState.cpp.
extern ModoSistema modoActual;
extern ModoSistema modoAntesDeAlerta;
extern bool pantallaSucia;
extern bool alertaImpactoActiva;
extern bool alertaSosActiva;
extern ModoSistema modoAntesDeSos;
extern uint32_t instanteInicioAlerta;
extern uint32_t instanteInicioSplash;
extern float picoImpactoG;

// ============================================================================
// UTILIDADES I2C COMUNES
// ============================================================================
static inline bool direccionI2CResponde(uint8_t direccion) {
  Wire.beginTransmission(direccion);
  return Wire.endTransmission(true) == 0;
}

static inline bool leerRegistroI2C(
  uint8_t direccion,
  uint8_t registro,
  uint8_t &valor
) {
  Wire.beginTransmission(direccion);
  Wire.write(registro);

  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  const size_t recibidos = Wire.requestFrom(direccion, (size_t)1, true);
  if (recibidos != 1) {
    return false;
  }

  valor = Wire.read();
  return true;
}

// Recuperacion basica de un bus I2C retenido por un esclavo que deja SDA en LOW.
// Se usa solo durante inicializacion o recuperacion; no forma parte del camino
// normal de muestreo.
static inline void recuperarBusI2C() {
  using namespace VitalWatchConfig;

  pinMode(PIN_I2C_SDA, INPUT_PULLUP);
  pinMode(PIN_I2C_SCL, OUTPUT_OPEN_DRAIN);
  digitalWrite(PIN_I2C_SCL, HIGH);
  delayMicroseconds(5);

  if (digitalRead(PIN_I2C_SDA) == LOW) {
    for (uint8_t pulso = 0; pulso < 9; ++pulso) {
      digitalWrite(PIN_I2C_SCL, LOW);
      delayMicroseconds(5);
      digitalWrite(PIN_I2C_SCL, HIGH);
      delayMicroseconds(5);
    }

    // Condicion STOP manual.
    pinMode(PIN_I2C_SDA, OUTPUT_OPEN_DRAIN);
    digitalWrite(PIN_I2C_SDA, LOW);
    delayMicroseconds(5);
    digitalWrite(PIN_I2C_SCL, HIGH);
    delayMicroseconds(5);
    digitalWrite(PIN_I2C_SDA, HIGH);
    delayMicroseconds(5);
  }

  pinMode(PIN_I2C_SDA, INPUT_PULLUP);
  pinMode(PIN_I2C_SCL, INPUT_PULLUP);
}

#endif
