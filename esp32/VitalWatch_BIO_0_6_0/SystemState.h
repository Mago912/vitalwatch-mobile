#ifndef VITALWATCH_SYSTEM_STATE_H
#define VITALWATCH_SYSTEM_STATE_H

#include <Arduino.h>
#include "Configuracion.h"

/*
  Estado compartido de la APLICACION.
  Los sensores no deben escribir directamente modoActual ni decidir que pantalla
  mostrar. El .ino/SystemController consume eventos y modifica este estado.
*/

struct ComponentHealth {
  bool imuReady;
  bool ppgReady;
  bool displayReady;
  uint32_t i2cErrors;
};

struct RuntimeMetrics {
  uint32_t loopLastUs;
  uint32_t loopMaxUs;
  uint64_t loopAccumUs;
  uint32_t loopCount;

  uint32_t ppgServiceGapUs;
  uint32_t ppgServiceGapMaxUs;
  uint32_t imuServiceGapUs;
  uint32_t imuServiceGapMaxUs;
  uint32_t displayRenderLastUs;
  uint32_t displayRenderMaxUs;
};

extern ModoSistema modoActual;
extern ModoSistema modoAntesDeAlerta;
extern bool alertaImpactoActiva;
extern uint32_t instanteInicioAlertaMs;
extern uint32_t instanteInicioSplashMs;
extern ComponentHealth systemHealth;
extern RuntimeMetrics runtimeMetrics;

void inicializarEstadoSistema();
void registrarDuracionLoop(uint32_t duracionUs);
const char* nombreCalidad(SignalQuality calidad);

#endif
