#ifndef VITALWATCH_CONTROL_REMOTO_H
#define VITALWATCH_CONTROL_REMOTO_H

#include <Arduino.h>
#include "Configuracion.h"

// [BIOSYS-L1] Puente seguro entre órdenes remotas y la máquina de vistas local.
// La tarea de red solo deja una orden pendiente. La TFT se modifica desde
// loop(), en el mismo nucleo que dibuja la interfaz, para evitar accesos SPI
// simultaneos.
enum class VistaPantallaRemota : uint8_t {
  MENU = 0,
  SIGNOS,
  MOVIMIENTO,
  ESTADO,
  MEDICACION
};

static volatile bool ordenPantallaPendiente = false;
static volatile bool reportePantallaPendiente = false;
static volatile bool okRemotoPendiente = false;
static volatile bool entradaRemotaAplicadaPendiente = false;
static volatile bool pantallaDeseadaEncendida = true;
static volatile VistaPantallaRemota vistaPantallaDeseada = VistaPantallaRemota::MENU;
static bool pantallaEncendidaActual = true;
static bool despertarPantallaPendiente = false;
static uint32_t instanteDespertarPantalla = 0;
static VistaPantallaRemota ultimaVistaNormal = VistaPantallaRemota::MENU;

static inline VistaPantallaRemota leerVistaPantallaRemota(const char* vista) {
  if (vista == nullptr) return VistaPantallaRemota::MENU;
  if (strcmp(vista, "vitals") == 0) return VistaPantallaRemota::SIGNOS;
  if (strcmp(vista, "movement") == 0) return VistaPantallaRemota::MOVIMIENTO;
  if (strcmp(vista, "status") == 0) return VistaPantallaRemota::ESTADO;
  if (strcmp(vista, "medication") == 0) return VistaPantallaRemota::MEDICACION;
  return VistaPantallaRemota::MENU;
}

static inline const char* nombreVistaPantallaRemota(VistaPantallaRemota vista) {
  switch (vista) {
    case VistaPantallaRemota::SIGNOS: return "vitals";
    case VistaPantallaRemota::MOVIMIENTO: return "movement";
    case VistaPantallaRemota::ESTADO: return "status";
    case VistaPantallaRemota::MEDICACION: return "medication";
    default: return "menu";
  }
}

static inline ModoSistema modoParaVistaPantalla(VistaPantallaRemota vista) {
  switch (vista) {
    case VistaPantallaRemota::SIGNOS: return ModoSistema::SIGNOS_VITALES;
    case VistaPantallaRemota::MOVIMIENTO: return ModoSistema::DIAGNOSTICO_MOVIMIENTO;
    case VistaPantallaRemota::ESTADO: return ModoSistema::ESTADO_SISTEMA;
    case VistaPantallaRemota::MEDICACION: return ModoSistema::MEDICACION;
    default: return ModoSistema::MENU;
  }
}

static inline VistaPantallaRemota vistaParaModoActual() {
  switch (modoActual) {
    case ModoSistema::MENU: return VistaPantallaRemota::MENU;
    case ModoSistema::SIGNOS_VITALES: return VistaPantallaRemota::SIGNOS;
    case ModoSistema::DIAGNOSTICO_MOVIMIENTO: return VistaPantallaRemota::MOVIMIENTO;
    case ModoSistema::ESTADO_SISTEMA: return VistaPantallaRemota::ESTADO;
    case ModoSistema::MEDICACION: return VistaPantallaRemota::MEDICACION;
    default: return ultimaVistaNormal;
  }
}

static inline void escribirBacklight(bool encendido) {
  if (VitalWatchConfig::PIN_TFT_BACKLIGHT < 0) return;
  const bool nivelAlto = encendido
    ? VitalWatchConfig::TFT_BACKLIGHT_ACTIVO_ALTO
    : !VitalWatchConfig::TFT_BACKLIGHT_ACTIVO_ALTO;
  digitalWrite(VitalWatchConfig::PIN_TFT_BACKLIGHT, nivelAlto ? HIGH : LOW);
}

static inline void inicializarControlRemotoPantalla() {
  if (VitalWatchConfig::PIN_TFT_BACKLIGHT >= 0) {
    pinMode(VitalWatchConfig::PIN_TFT_BACKLIGHT, OUTPUT);
    escribirBacklight(true);
  }
  pantallaEncendidaActual = true;
  ultimaVistaNormal = VistaPantallaRemota::MENU;
}

// La Edge Function solo entrega inputAction mientras input_command_at sea mas
// reciente que input_reported_at. El loop consume OK una vez y la tarea de red
// confirma su aplicacion despues de modificar realmente la alerta.
static inline void solicitarEntradaRemota(const char* accion) {
  if (accion == nullptr || strcmp(accion, "ok") != 0) return;
  if (!okRemotoPendiente && !entradaRemotaAplicadaPendiente) {
    okRemotoPendiente = true;
  }
}

static inline bool consumirOkRemotoPendiente() {
  if (!okRemotoPendiente) return false;
  okRemotoPendiente = false;
  entradaRemotaAplicadaPendiente = true;
  return true;
}

static inline bool entradaRemotaAplicadaSinReportar() {
  return entradaRemotaAplicadaPendiente;
}

static inline void confirmarReporteEntradaRemota() {
  entradaRemotaAplicadaPendiente = false;
}

static inline const char* estadoAlertaRemotaReportado() {
  if (alertaSosActiva) return "sos";
  if (alertaImpactoActiva) return "fall";
  return "none";
}

// Puede llamarse desde la tarea de red. No toca la TFT.
static inline void solicitarControlPantallaRemoto(bool encendida, const char* vista) {
  const VistaPantallaRemota nuevaVista = leerVistaPantallaRemota(vista);
  pantallaDeseadaEncendida = encendida;
  vistaPantallaDeseada = nuevaVista;

  const bool estadoDistinto = encendida != pantallaEncendidaActual;
  const bool vistaDistinta = encendida && nuevaVista != vistaParaModoActual();
  if (estadoDistinto || vistaDistinta) {
    ordenPantallaPendiente = true;
  }
}

static inline bool pantallaRemotaEncendida() {
  return pantallaEncendidaActual;
}

static inline const char* vistaPantallaRemotaReportada() {
  const VistaPantallaRemota actual = vistaParaModoActual();
  ultimaVistaNormal = actual;
  return nombreVistaPantallaRemota(actual);
}

static inline bool consumirReportePantallaPendiente() {
  if (!reportePantallaPendiente) return false;
  reportePantallaPendiente = false;
  return true;
}

static inline void iniciarDespertarPantalla() {
  if (pantallaEncendidaActual || despertarPantallaPendiente) return;
  tft.enableSleep(false);
  instanteDespertarPantalla = millis();
  despertarPantallaPendiente = true;
}

// Alertas y botones fisicos pueden despertar la TFT temporalmente. La orden
// guardada en Supabase no se modifica y volvera a aplicarse en la proxima
// sincronizacion.
static inline void forzarPantallaTemporalmente() {
  iniciarDespertarPantalla();
}

static inline void procesarControlRemotoPantalla() {
  if (despertarPantallaPendiente &&
      millis() - instanteDespertarPantalla >= 120UL) {
    tft.enableDisplay(true);
    escribirBacklight(true);
    despertarPantallaPendiente = false;
    pantallaEncendidaActual = true;
    pantallaSucia = true;
    reportePantallaPendiente = true;
  }

  if (!ordenPantallaPendiente) return;

  // Splash, portal WiFi y alertas criticas conservan el control local.
  if (modoActual == ModoSistema::SPLASH ||
      modoActual == ModoSistema::CONFIGURACION_WIFI ||
      alertaImpactoActiva || alertaSosActiva) {
    return;
  }

  const bool encendida = pantallaDeseadaEncendida;
  const VistaPantallaRemota vista = vistaPantallaDeseada;
  ordenPantallaPendiente = false;

  if (!encendida) {
    despertarPantallaPendiente = false;
    escribirBacklight(false);
    tft.enableDisplay(false);
    tft.enableSleep(true);
    pantallaEncendidaActual = false;
    reportePantallaPendiente = true;
    Serial.println(F("[INFO][DISPLAY] Pantalla apagada desde la app"));
    return;
  }

  modoActual = modoParaVistaPantalla(vista);
  ultimaVistaNormal = vista;
  pantallaSucia = true;

  if (!pantallaEncendidaActual) {
    iniciarDespertarPantalla();
  } else {
    reportePantallaPendiente = true;
    Serial.print(F("[INFO][DISPLAY] Vista remota: "));
    Serial.println(nombreVistaPantallaRemota(vista));
  }
}

#endif
