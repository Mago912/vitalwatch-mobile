#include <Wire.h>
#include <SPI.h>

#include "Configuracion.h"
#include "Botones.h"
#include "Sensor_Movimiento.h"
#include "Sensor_Oxigeno.h"
#include "Configuracion_WiFi.h"
#include "Sincronizacion_Medicacion.h"
#include "Interfaz.h"
#include "Telemetria.h"

// ============================================================================
// VITALWATCH FW 0.8.0
// Punto de entrada y orquestacion.
//
// Regla principal: loop() coordina modulos rapidos y no bloqueantes. El MPU y
// el MAX30102 se procesan independientemente de la pantalla que el usuario este
// mirando. La interfaz nunca "posee" la adquisicion de sensores.
// ============================================================================

static inline void irAlMenu() {
  if (alertaImpactoActiva || alertaSosActiva) return;
  modoActual = ModoSistema::MENU;
  pantallaSucia = true;
}

static inline void abrirModoSeleccionado() {
  if (alertaImpactoActiva || alertaSosActiva) return;
  modoActual = modoSeleccionadoMenu();
  pantallaSucia = true;
}

static inline void abrirVistaAnterior() {
  if (alertaImpactoActiva || alertaSosActiva) return;

  switch (modoActual) {
    case ModoSistema::MENU:
      menuAnterior();
      break;
    case ModoSistema::SIGNOS_VITALES:
      modoActual = ModoSistema::ESTADO_SISTEMA;
      pantallaSucia = true;
      break;
    case ModoSistema::DIAGNOSTICO_MOVIMIENTO:
      modoActual = ModoSistema::SIGNOS_VITALES;
      pantallaSucia = true;
      break;
    case ModoSistema::ESTADO_SISTEMA:
      modoActual = ModoSistema::DIAGNOSTICO_MOVIMIENTO;
      pantallaSucia = true;
      break;
    case ModoSistema::MEDICACION:
      medicacionAnterior();
      break;
    default:
      break;
  }
}

static inline void abrirVistaSiguiente() {
  if (alertaImpactoActiva || alertaSosActiva) return;

  switch (modoActual) {
    case ModoSistema::MENU:
      menuSiguiente();
      break;
    case ModoSistema::SIGNOS_VITALES:
      modoActual = ModoSistema::DIAGNOSTICO_MOVIMIENTO;
      pantallaSucia = true;
      break;
    case ModoSistema::DIAGNOSTICO_MOVIMIENTO:
      modoActual = ModoSistema::ESTADO_SISTEMA;
      pantallaSucia = true;
      break;
    case ModoSistema::ESTADO_SISTEMA:
      modoActual = ModoSistema::SIGNOS_VITALES;
      pantallaSucia = true;
      break;
    case ModoSistema::MEDICACION:
      medicacionSiguiente();
      break;
    default:
      break;
  }
}

static inline void activarAlertaImpacto() {
  if (alertaImpactoActiva) return;

  // Se conserva la vista anterior para regresar sin destruir el estado PPG.
  // La adquisicion optica CONTINUA durante la alerta.
  if (modoActual != ModoSistema::SPLASH &&
      modoActual != ModoSistema::ALERTA_IMPACTO) {
    modoAntesDeAlerta = modoActual;
  } else {
    modoAntesDeAlerta = ModoSistema::MENU;
  }

  alertaImpactoActiva = true;
  instanteInicioAlerta = millis();
  modoActual = ModoSistema::ALERTA_IMPACTO;
  pantallaSucia = true;

  Serial.println(F("[EVENT][SYSTEM] Aviso visual de posible impacto activado"));
}

static inline void finalizarAlertaImpacto() {
  if (!alertaImpactoActiva) return;

  alertaImpactoActiva = false;
  modoActual = (modoAntesDeAlerta == ModoSistema::SPLASH)
    ? ModoSistema::MENU
    : modoAntesDeAlerta;
  pantallaSucia = true;

  // Rearme rapido para demostracion. Los umbrales siguen siendo experimentales.
  ultimoImpacto = millis() - MovimientoConfig::BLOQUEO_NUEVO_IMPACTO_MS;

  Serial.println(F("[INFO][SYSTEM] Aviso de impacto cerrado"));
}

static inline void activarSos() {
  if (alertaSosActiva) return;

  if (modoActual != ModoSistema::SPLASH &&
      modoActual != ModoSistema::ALERTA_IMPACTO &&
      modoActual != ModoSistema::ALERTA_SOS) {
    modoAntesDeSos = modoActual;
  } else {
    modoAntesDeSos = ModoSistema::MENU;
  }

  alertaSosActiva = true;
  alertaImpactoActiva = false;
  modoActual = ModoSistema::ALERTA_SOS;
  pantallaSucia = true;
  notificarSosTelemetria();
  Serial.println(F("[EVENT][SYSTEM] SOS solicitado desde botones"));
}

static inline void finalizarAlertaSos() {
  if (!alertaSosActiva) return;

  alertaSosActiva = false;
  modoActual = modoAntesDeSos == ModoSistema::SPLASH
    ? ModoSistema::MENU
    : modoAntesDeSos;
  pantallaSucia = true;
  Serial.println(F("[INFO][SYSTEM] Aviso SOS cerrado"));
}

// Diagnostico manual solicitado mediante OK largo. Esta operacion puede tardar
// algunos cientos de ms porque reinicializa fisicamente los dispositivos; solo
// ocurre por accion explicita del usuario, no dentro del muestreo normal.
static inline void ejecutarDiagnosticoManualSensores() {
  if (alertaImpactoActiva) return;

  Serial.println(F("[INFO][SYSTEM] Diagnostico manual de sensores"));

  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
  Wire.setTimeOut(VitalWatchConfig::TIMEOUT_I2C_MS);

  forzarReconexionMPU();
  inicializarMAX30102();

  // La libreria MAX3010x puede tocar la configuracion del bus. Se restablece la
  // frecuencia comun y se verifica que la IMU siga accesible.
  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
  Wire.setTimeOut(VitalWatchConfig::TIMEOUT_I2C_MS);
  if (!revalidarMPU()) {
    forzarReconexionMPU();
  }

  pantallaSucia = true;
}

// ============================================================================
// BOTONES
// ============================================================================
static inline void procesarBotonesSistema() {
  actualizarBotones();

  const EventoBoton evento = consumirEventoBoton();
  if (evento == EventoBoton::NINGUNO) return;

  Serial.print(F("[INFO][BTN] "));
  Serial.println(nombreEventoBoton(evento));

  // El indicador visual de boton es deliberadamente pequeno y temporal.
  marcarBotonPresionado(evento);

  // Izquierda + derecha durante 2.5 s funciona desde cualquier vista.
  if (evento == EventoBoton::SOS) {
    activarSos();
    return;
  }

  // Durante la pantalla de arranque se ignora la navegacion. Un impacto real
  // detectado por el MPU sigue teniendo prioridad y puede interrumpir el splash.
  if (modoActual == ModoSistema::SPLASH) return;

  // En una alerta solo OK puede cerrarla; izquierda/derecha no la descartan por
  // accidente.
  if (alertaImpactoActiva) {
    if (evento == EventoBoton::OK) finalizarAlertaImpacto();
    return;
  }

  if (alertaSosActiva) {
    if (evento == EventoBoton::OK) finalizarAlertaSos();
    return;
  }

  // Durante el portal, la navegacion queda pausada para que las instrucciones
  // WiFi permanezcan visibles. El gesto SOS sigue teniendo prioridad.
  if (modoActual == ModoSistema::CONFIGURACION_WIFI) return;

  if (evento == EventoBoton::OK_LARGO) {
    if (modoActual == ModoSistema::MEDICACION) {
      confirmarMedicacionSeleccionada();
      return;
    }
    ejecutarDiagnosticoManualSensores();
    return;
  }

  switch (evento) {
    case EventoBoton::IZQUIERDA:
      abrirVistaAnterior();
      break;

    case EventoBoton::DERECHA:
      abrirVistaSiguiente();
      break;

    case EventoBoton::OK:
      if (modoActual == ModoSistema::MENU) abrirModoSeleccionado();
      else irAlMenu();
      break;

    default:
      break;
  }
}

// ============================================================================
// MONITOR SERIE - respaldo de desarrollo
// ============================================================================
static inline void procesarSerie() {
  while (Serial.available()) {
    const char comando = Serial.read();
    if (comando == '\n' || comando == '\r') continue;

    switch (comando) {
      case '0':
        irAlMenu();
        break;
      case '1':
        modoActual = ModoSistema::SIGNOS_VITALES;
        pantallaSucia = true;
        break;
      case '2':
        modoActual = ModoSistema::DIAGNOSTICO_MOVIMIENTO;
        pantallaSucia = true;
        break;
      case '3':
        modoActual = ModoSistema::ESTADO_SISTEMA;
        pantallaSucia = true;
        break;
      case '4':
        modoActual = ModoSistema::MEDICACION;
        pantallaSucia = true;
        break;
      case 'R':
      case 'r':
        ejecutarDiagnosticoManualSensores();
        break;
      default:
        Serial.println(F("0=menu 1=signos 2=IMU 3=estado 4=medicacion R=test"));
        break;
    }
  }
}

// ============================================================================
// SETUP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(50); // solo para estabilizar el puerto durante el arranque

  inicializarBotones();
  const bool borrarRedWiFi =
    digitalRead(BotonesConfig::PIN_OK) == LOW;

  // Pantalla primero: el usuario ve inmediatamente el logo mientras se completa
  // la inicializacion del resto del hardware.
  SPI.begin(
    VitalWatchConfig::TFT_SCLK,
    -1,
    VitalWatchConfig::TFT_MOSI,
    VitalWatchConfig::TFT_CS
  );

  tft.initR(INITR_144GREENTAB);
  tft.setRotation(VitalWatchConfig::ROTACION_TFT);
  tft.setTextWrap(false);

  modoActual = ModoSistema::SPLASH;
  instanteInicioSplash = millis();
  dibujarSplash();
  pantallaSucia = false;

  // Bus I2C comun.
  recuperarBusI2C();
  Wire.begin(
    VitalWatchConfig::PIN_I2C_SDA,
    VitalWatchConfig::PIN_I2C_SCL,
    VitalWatchConfig::FRECUENCIA_I2C_HZ
  );
  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
  Wire.setTimeOut(VitalWatchConfig::TIMEOUT_I2C_MS);

  inicializarMPU();
  inicializarMAX30102();

  // Reestablece contrato comun de I2C despues de inicializar MAX30102.
  Wire.setClock(VitalWatchConfig::FRECUENCIA_I2C_HZ);
  Wire.setTimeOut(VitalWatchConfig::TIMEOUT_I2C_MS);
  if (!revalidarMPU()) {
    forzarReconexionMPU();
  }

  // Mantener OK durante el encendido borra la red anterior y abre el portal.
  prepararConfiguracionWiFi(borrarRedWiFi);

  // La sincronizacion HTTPS corre en el otro nucleo y no bloquea los sensores.
  inicializarSincronizacionMedicacion();
  inicializarTelemetria();

  Serial.print(F("[READY] VitalWatch FW "));
  Serial.println(VitalWatchConfig::VERSION_FIRMWARE);
  Serial.println(F("[INFO] PPG e IMU se procesan siempre en segundo plano"));
}

// ============================================================================
// LOOP COOPERATIVO
// ============================================================================
void loop() {
  // 1) Entrada de usuario.
  procesarBotonesSistema();
  procesarSerie();

  // 2) Sensores. Ambos se atienden SIEMPRE, independientemente de la vista.
  procesarMovimiento();
  procesarOxigeno();
  procesarCambiosMedicacion();
  procesarCambiosConfiguracionWiFi();
  procesarTelemetriaPeriodica();

  // 3) Eventos de mayor prioridad.
  if (consumirImpactoPendiente()) {
    notificarCaidaTelemetria(picoImpactoG);
    activarAlertaImpacto();
  }

  // 4) Fin no bloqueante del splash.
  if (modoActual == ModoSistema::SPLASH &&
      millis() - instanteInicioSplash >= VitalWatchConfig::DURACION_SPLASH_MS) {
    modoActual = ModoSistema::MENU;
    pantallaSucia = true;
  }

  // El cierre automatico queda deshabilitado por defecto. Se conserva el codigo
  // como opcion de configuracion sin duplicar logica.
  if (VitalWatchConfig::AUTO_CERRAR_ALERTA &&
      alertaImpactoActiva &&
      millis() - instanteInicioAlerta >= VitalWatchConfig::DURACION_ALERTA_MS) {
    finalizarAlertaImpacto();
  }

  // 5) UI. Redibuja completo solo cuando hace falta y actualiza regiones pequenas
  // (barra/footer) de forma independiente.
  renderizarVistaActual();
  actualizarInterfazPeriodica();

  // Cede tiempo al scheduler interno del ESP32 sin usar delay como temporizador.
  yield();
}
