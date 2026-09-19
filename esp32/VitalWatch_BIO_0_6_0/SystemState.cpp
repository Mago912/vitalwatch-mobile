#include "SystemState.h"
#include <string.h>

ModoSistema modoActual = ModoSistema::SPLASH;
ModoSistema modoAntesDeAlerta = ModoSistema::MENU;
bool alertaImpactoActiva = false;
uint32_t instanteInicioAlertaMs = 0;
uint32_t instanteInicioSplashMs = 0;

ComponentHealth systemHealth = {false, false, false, 0};
RuntimeMetrics runtimeMetrics = {0,0,0,0,0,0,0,0,0,0};

void inicializarEstadoSistema() {
  modoActual = ModoSistema::SPLASH;
  modoAntesDeAlerta = ModoSistema::MENU;
  alertaImpactoActiva = false;
  instanteInicioAlertaMs = 0;
  instanteInicioSplashMs = millis();
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
    case SignalQuality::GOOD: return "GOOD";
    case SignalQuality::FAIR: return "FAIR";
    case SignalQuality::POOR: return "POOR";
    case SignalQuality::NO_SIGNAL: return "NO_SIGNAL";
    default: return "INVALID";
  }
}
