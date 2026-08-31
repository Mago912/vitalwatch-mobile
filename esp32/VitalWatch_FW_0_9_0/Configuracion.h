#ifndef VITALWATCH_CONFIGURACION_H
#define VITALWATCH_CONFIGURACION_H

#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>

// ============================================================================
// VITALWATCH - CONFIGURACION CENTRAL
// Firmware objetivo: ESP32 NodeMCU / ESP32 Dev Module de 38 pines.
// Pantalla: ST7735 1.44" 128x128.
//
// Este archivo concentra pines, tiempos, estados globales simples y utilidades
// de bajo nivel. La idea es evitar numeros "magicos" repartidos por el codigo.
// ============================================================================

namespace VitalWatchConfig {

  // --------------------------------------------------------------------------
  // Version del firmware entregado en esta revision.
  // --------------------------------------------------------------------------
  static constexpr const char* VERSION_FIRMWARE = "0.9.0";

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
static Adafruit_ST7735 tft(
  VitalWatchConfig::TFT_CS,
  VitalWatchConfig::TFT_DC,
  VitalWatchConfig::TFT_RST
);

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

static ModoSistema modoActual = ModoSistema::SPLASH;
static ModoSistema modoAntesDeAlerta = ModoSistema::MENU;
static bool pantallaSucia = true;
static bool alertaImpactoActiva = false;
static bool alertaSosActiva = false;
static ModoSistema modoAntesDeSos = ModoSistema::MENU;
static uint32_t instanteInicioAlerta = 0;
static uint32_t instanteInicioSplash = 0;

// Estado fisico de componentes. Los modulos actualizan estas banderas.
static bool mpuDisponible = false;
static bool max30102Disponible = false;

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
