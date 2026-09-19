#include <Arduino.h>
#include "Configuracion.h"
#include "SystemState.h"
#include "I2CBusService.h"
#include "Botones.h"
#include "Sensor_Movimiento.h"
#include "Sensor_Oxigeno.h"
#include "BioResearch.h"
#include "BioReplay.h"
#include "Interfaz.h"

/*
  ============================================================================
  VITALWATCH VW-BIO 0.6.0 — ORQUESTADOR DE VALIDACION BIOMEDICA
  ============================================================================

  Esta version implementa el contrato BIO -> Firmware recibido para 0.6.0.
  El .ino queda deliberadamente corto: orquesta servicios y eventos, pero no
  contiene drivers ni matematica de sensores.

  ORDEN DEL LOOP
  ---------------
  1. botones / comandos;
  2. IMU;
  3. PPG;
  4. eventos semanticos (POSSIBLE_IMPACT);
  5. estado global (splash/alerta);
  6. display incremental;
  7. logger de research no bloqueante;
  8. profiler.

  INVARIANTE: display y PPG NO deben detener el monitoreo cooperativo de IMU.
*/

namespace SystemController {

void goMenu(){if(alertaImpactoActiva)return;modoActual=ModoSistema::MENU;DisplayService::invalidateView();}
void openSelected(){if(alertaImpactoActiva)return;modoActual=DisplayService::selectedMenuMode();DisplayService::invalidateView();}

void previousView(){
  if(alertaImpactoActiva)return;
  if(modoActual==ModoSistema::MENU){DisplayService::menuPrevious();return;}
  if(modoActual==ModoSistema::SIGNOS_VITALES)modoActual=ModoSistema::ESTADO_SISTEMA;
  else if(modoActual==ModoSistema::DIAGNOSTICO_MOVIMIENTO)modoActual=ModoSistema::SIGNOS_VITALES;
  else if(modoActual==ModoSistema::ESTADO_SISTEMA)modoActual=ModoSistema::DIAGNOSTICO_MOVIMIENTO;
  DisplayService::invalidateView();
}
void nextView(){
  if(alertaImpactoActiva)return;
  if(modoActual==ModoSistema::MENU){DisplayService::menuNext();return;}
  if(modoActual==ModoSistema::SIGNOS_VITALES)modoActual=ModoSistema::DIAGNOSTICO_MOVIMIENTO;
  else if(modoActual==ModoSistema::DIAGNOSTICO_MOVIMIENTO)modoActual=ModoSistema::ESTADO_SISTEMA;
  else if(modoActual==ModoSistema::ESTADO_SISTEMA)modoActual=ModoSistema::SIGNOS_VITALES;
  DisplayService::invalidateView();
}

void activateImpactAlert(const PossibleImpactEvent &e){
  if(alertaImpactoActiva)return;
  modoAntesDeAlerta=(modoActual==ModoSistema::SPLASH||modoActual==ModoSistema::ALERTA_IMPACTO)?ModoSistema::MENU:modoActual;
  alertaImpactoActiva=true;instanteInicioAlertaMs=millis();modoActual=ModoSistema::ALERTA_IMPACTO;DisplayService::invalidateView();
  Serial.printf("[EVENT][SYSTEM] UI POSSIBLE_IMPACT t=%llu peak=%.2fg\n",(unsigned long long)e.timestampUs,e.peakG);
}
void closeImpactAlert(){
  if(!alertaImpactoActiva)return;alertaImpactoActiva=false;modoActual=(modoAntesDeAlerta==ModoSistema::SPLASH)?ModoSistema::MENU:modoAntesDeAlerta;MotionService::rearmImpactDemo();DisplayService::invalidateView();Serial.println(F("[INFO][SYSTEM] Alerta cerrada por usuario"));
}

void manualSensorTest(){
  if(alertaImpactoActiva)return;
  Serial.println(F("[INFO][SYSTEM] Reconexion manual solicitada"));
  I2CBusService::restoreConfig();MotionService::forceReconnect();PPGService::forceReconnect();I2CBusService::restoreConfig();if(!MotionService::revalidate())MotionService::forceReconnect();DisplayService::invalidateView();
}

void processButtons(){
  ButtonService::update();
  const EventoFisicoBoton physical=ButtonService::consumePhysicalPress();if(physical!=EventoFisicoBoton::NINGUNO)DisplayService::notifyPhysicalButton(physical);
  const EventoBoton action=ButtonService::consumeAction();if(action==EventoBoton::NINGUNO)return;
  Serial.printf("[INFO][BTN] action=%s\n",ButtonService::actionName(action));
  if(modoActual==ModoSistema::SPLASH)return;
  if(alertaImpactoActiva){if(action==EventoBoton::OK)closeImpactAlert();return;}
  if(action==EventoBoton::OK_LARGO){manualSensorTest();return;}
  if(action==EventoBoton::IZQUIERDA)previousView();else if(action==EventoBoton::DERECHA)nextView();else if(action==EventoBoton::OK){if(modoActual==ModoSistema::MENU)openSelected();else goMenu();}
}

void processSerial(){
  while(Serial.available()){
    const char c=Serial.read();if(c=='\n'||c=='\r')continue;
    if(c=='0')goMenu();else if(c=='1'){modoActual=ModoSistema::SIGNOS_VITALES;DisplayService::invalidateView();}
    else if(c=='2'){modoActual=ModoSistema::DIAGNOSTICO_MOVIMIENTO;DisplayService::invalidateView();}
    else if(c=='3'){modoActual=ModoSistema::ESTADO_SISTEMA;DisplayService::invalidateView();}
    else if(c=='r'||c=='R')manualSensorTest();
    else if(c=='i'||c=='I'){const auto&m=MotionService::diagnostics();const auto&p=PPGService::diagnostics();Serial.printf("[DIAG] loopMax=%lu ppgGapMax=%lu ppgDrops=%lu imuMiss=%lu imuJitter=%lu\n",(unsigned long)runtimeMetrics.loopMaxUs,(unsigned long)runtimeMetrics.ppgServiceGapMaxUs,(unsigned long)p.suspectedSoftwareDrops,(unsigned long)m.missedDeadlines,(unsigned long)m.maxAbsJitterUs);}
  }
}

void processEvents(){PossibleImpactEvent e;if(MotionService::consumePossibleImpact(e))activateImpactAlert(e);}
void processState(){if(modoActual==ModoSistema::SPLASH&&(uint32_t)(millis()-instanteInicioSplashMs)>=VitalWatchConfig::DURACION_SPLASH_MS){modoActual=ModoSistema::MENU;DisplayService::invalidateView();}}
}

void setup(){
  Serial.begin(115200);delay(50); // Solo estabilizacion del puerto durante boot.
  inicializarEstadoSistema();
  ButtonService::begin();
  DisplayService::begin(); // splash visible mientras se inicializan buses/sensores.
  I2CBusService::begin();
  MotionService::begin();
  PPGService::begin();
  I2CBusService::restoreConfig();
  if(!MotionService::revalidate())MotionService::forceReconnect();
  BioResearch::begin();
  BioReplay::begin();
  Serial.printf("[READY] VitalWatch %s %s | target %s %s | role=%s\n",
    VitalWatchConfig::FAMILIA_BIOMEDICA,
    VitalWatchConfig::VERSION_BIOMEDICA,
    VitalWatchConfig::FAMILIA_SISTEMA,
    VitalWatchConfig::VERSION_SISTEMA_OBJETIVO,
    VitalWatchConfig::ROL_BUILD);
  Serial.println(F("[INFO] timing/FIFO/status/dirty-rectangles/research instrumentation activos"));
}

void loop(){
  const uint32_t loopStart=micros();
  SystemController::processButtons();
#if BIO_REPLAY_MODE
  // En replay, BioReplay es el unico consumidor de Serial. Si processSerial()
  // leyera antes, interpretaria cada caracter del CSV como comando de UI.
  BioReplay::update();
#else
  SystemController::processSerial();
#endif
  MotionService::update();
  PPGService::update();
  SystemController::processEvents();
  SystemController::processState();
  DisplayService::update();
  BioResearch::update();
  registrarDuracionLoop(micros()-loopStart);
  yield();
}
