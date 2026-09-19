#include "SystemState.h"
#include <string.h>

// [BIOSYS-B2] Instancias unicas visibles por el .ino y todos los modulos .cpp.
Adafruit_ST7735 tft(
  VitalWatchConfig::TFT_CS,
  VitalWatchConfig::TFT_DC,
  VitalWatchConfig::TFT_RST
);

ModoSistema modoActual = ModoSistema::SPLASH;
ModoSistema modoAntesDeAlerta = ModoSistema::MENU;
bool pantallaSucia = true;
bool alertaImpactoActiva = false;
bool alertaSosActiva = false;
ModoSistema modoAntesDeSos = ModoSistema::MENU;
uint32_t instanteInicioAlerta = 0;
uint8_t segundosCuentaRegresivaCaida = 0;
bool verificandoCaida = false;
bool caidaConfirmada = false;
uint32_t instanteInicioSplash = 0;
float picoImpactoG = 0.0f;

ComponentHealth systemHealth = {false, false, false, 0};
RuntimeMetrics runtimeMetrics = {0,0,0,0,0,0,0,0,0,0};

void inicializarEstadoSistema() {
  modoActual = ModoSistema::SPLASH;
  modoAntesDeAlerta = ModoSistema::MENU;
  pantallaSucia = true;
  alertaImpactoActiva = false;
  alertaSosActiva = false;
  modoAntesDeSos = ModoSistema::MENU;
  instanteInicioAlerta = 0;
  segundosCuentaRegresivaCaida = 0;
  verificandoCaida = false;
  caidaConfirmada = false;
  instanteInicioSplash = millis();
  picoImpactoG = 0.0f;
  systemHealth = {false, false, false, 0};
  memset(&runtimeMetrics, 0, sizeof(runtimeMetrics));
}

void registrarDuracionLoop(uint32_t duracionUs) {
  runtimeMetrics.loopLastUs = duracionUs;
  if (duracionUs > runtimeMetrics.loopMaxUs) runtimeMetrics.loopMaxUs = duracionUs;
  runtimeMetrics.loopAccumUs += duracionUs;
  ++runtimeMetrics.loopCount;
}

const char* nombreCalidad(SignalQuality calidad) {
  switch (calidad) {
    case SignalQuality::GOOD: return "BUENA";
    case SignalQuality::FAIR: return "ACEPTABLE";
    case SignalQuality::POOR: return "BAJA";
    case SignalQuality::NO_SIGNAL: return "SIN SENAL";
    default: return "INVALIDA";
  }
}
