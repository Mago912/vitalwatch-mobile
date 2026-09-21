#include <Wire.h>
#include <SPI.h>

#include "Configuracion.h"
#include "SystemState.h"
#include "I2CBusService.h"
#include "Botones.h"
#include "Sensor_Movimiento.h"
#include "Sensor_Oxigeno.h"
#include "Configuracion_WiFi.h"
#include "Control_Remoto.h"
#include "Sincronizacion_Medicacion.h"
#include "Interfaz.h"
#include "Telemetria.h"
#include "BioResearch.h"

// ============================================================================
// [BIOSYS-C1] VITALWATCH VW-BIOSYS 1.0.9
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
  registrarCambioLocalPantalla();
}

static inline void abrirModoSeleccionado() {
  if (alertaImpactoActiva || alertaSosActiva) return;
  modoActual = modoSeleccionadoMenu();
  if (modoActual == ModoSistema::MENSAJERIA) iniciarFlujoMensajeria();
  pantallaSucia = true;
  registrarCambioLocalPantalla();
}

static inline void abrirVistaAnterior() {
  if (alertaImpactoActiva || alertaSosActiva) return;

  switch (modoActual) {
    case ModoSistema::MENU:
      menuAnterior();
      break;
    case ModoSistema::MENSAJERIA:
      mensajeriaAnterior();
      break;
    case ModoSistema::SIGNOS_VITALES:
      modoActual = ModoSistema::ESTADO_SISTEMA;
      pantallaSucia = true;
      registrarCambioLocalPantalla();
      break;
    case ModoSistema::DIAGNOSTICO_MOVIMIENTO:
      modoActual = ModoSistema::SIGNOS_VITALES;
      pantallaSucia = true;
      registrarCambioLocalPantalla();
      break;
    case ModoSistema::ESTADO_SISTEMA:
      modoActual = ModoSistema::DIAGNOSTICO_MOVIMIENTO;
      pantallaSucia = true;
      registrarCambioLocalPantalla();
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
    case ModoSistema::MENSAJERIA:
      mensajeriaSiguiente();
      break;
    case ModoSistema::SIGNOS_VITALES:
      modoActual = ModoSistema::DIAGNOSTICO_MOVIMIENTO;
      pantallaSucia = true;
      registrarCambioLocalPantalla();
      break;
    case ModoSistema::DIAGNOSTICO_MOVIMIENTO:
      modoActual = ModoSistema::ESTADO_SISTEMA;
      pantallaSucia = true;
      registrarCambioLocalPantalla();
      break;
    case ModoSistema::ESTADO_SISTEMA:
      modoActual = ModoSistema::SIGNOS_VITALES;
      pantallaSucia = true;
      registrarCambioLocalPantalla();
      break;
    case ModoSistema::MEDICACION:
      medicacionSiguiente();
      break;
    default:
      break;
  }
}

enum class EstadoDeteccionCaida : uint8_t {
  INACTIVA = 0,
  VERIFICANDO,
  CUENTA_REGRESIVA,
  CONFIRMADA
};

static EstadoDeteccionCaida estadoDeteccionCaida = EstadoDeteccionCaida::INACTIVA;
static uint32_t inicioVerificacionCaida = 0;
static uint32_t inicioInmovilidad = 0;
static uint32_t inicioCuentaRegresiva = 0;

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
  estadoDeteccionCaida = EstadoDeteccionCaida::VERIFICANDO;
  verificandoCaida = true;
  caidaConfirmada = false;
  segundosCuentaRegresivaCaida = 0;
  inicioVerificacionCaida = millis();
  inicioInmovilidad = 0;
  inicioCuentaRegresiva = 0;
  forzarPantallaTemporalmente();
  instanteInicioAlerta = millis();
  modoActual = ModoSistema::ALERTA_IMPACTO;
  pantallaSucia = true;
  reportePantallaPendiente = true;

  Serial.println(F("[EVENT][SYSTEM] Impacto posible; verificando inmovilidad"));
}

static inline void finalizarAlertaImpacto() {
  if (!alertaImpactoActiva) return;

  alertaImpactoActiva = false;
  estadoDeteccionCaida = EstadoDeteccionCaida::INACTIVA;
  verificandoCaida = false;
  caidaConfirmada = false;
  segundosCuentaRegresivaCaida = 0;
  modoActual = (modoAntesDeAlerta == ModoSistema::SPLASH)
    ? ModoSistema::MENU
    : modoAntesDeAlerta;
  pantallaSucia = true;
  reportePantallaPendiente = true;

  // [BIOSYS-C2] El servicio BIO conserva el lockout y expone un rearme seguro.
  MotionService::rearmImpactDemo();

  Serial.println(F("[INFO][SYSTEM] Aviso de impacto cerrado"));
}

static inline void procesarDeteccionCaida() {
  if (estadoDeteccionCaida == EstadoDeteccionCaida::INACTIVA ||
      estadoDeteccionCaida == EstadoDeteccionCaida::CONFIRMADA) {
    return;
  }

  const uint32_t ahora = millis();
  if (estadoDeteccionCaida == EstadoDeteccionCaida::VERIFICANDO) {
    const uint32_t transcurrido = ahora - inicioVerificacionCaida;
    if (transcurrido < VitalWatchConfig::CAIDA_ESTABILIZACION_MS) return;

    const MotionSample &muestra = MotionService::latest();
    const bool inmovil = muestra.valid &&
      fabsf(muestra.accelerationMagnitudeG - 1.0f) <=
        VitalWatchConfig::CAIDA_ACELERACION_TOLERANCIA_G &&
      muestra.gyroMagnitudeRadS <= VitalWatchConfig::CAIDA_GIRO_MAX_RAD_S;

    if (inmovil) {
      if (inicioInmovilidad == 0) inicioInmovilidad = ahora;
      if (ahora - inicioInmovilidad >= VitalWatchConfig::CAIDA_INMOVILIDAD_REQUERIDA_MS) {
        estadoDeteccionCaida = EstadoDeteccionCaida::CUENTA_REGRESIVA;
        verificandoCaida = false;
        inicioCuentaRegresiva = ahora;
        segundosCuentaRegresivaCaida =
          (uint8_t)(VitalWatchConfig::CAIDA_CUENTA_REGRESIVA_MS / 1000UL);
        pantallaSucia = true;
        reportePantallaPendiente = true;
        Serial.println(F("[EVENT][SYSTEM] Inmovilidad confirmada; inicia cuenta regresiva"));
      }
    } else {
      inicioInmovilidad = 0;
    }

    if (transcurrido >= VitalWatchConfig::CAIDA_VERIFICACION_MAX_MS) {
      Serial.println(F("[INFO][SYSTEM] Impacto descartado: no hubo inmovilidad sostenida"));
      finalizarAlertaImpacto();
    }
    return;
  }

  const uint32_t restanteMs = ahora - inicioCuentaRegresiva >=
      VitalWatchConfig::CAIDA_CUENTA_REGRESIVA_MS
    ? 0
    : VitalWatchConfig::CAIDA_CUENTA_REGRESIVA_MS - (ahora - inicioCuentaRegresiva);
  const uint8_t segundos = (uint8_t)((restanteMs + 999UL) / 1000UL);
  if (segundos != segundosCuentaRegresivaCaida) {
    segundosCuentaRegresivaCaida = segundos;
    pantallaSucia = true;
  }

  if (restanteMs == 0) {
    estadoDeteccionCaida = EstadoDeteccionCaida::CONFIRMADA;
    caidaConfirmada = true;
    segundosCuentaRegresivaCaida = 0;
    pantallaSucia = true;
    reportePantallaPendiente = true;
    notificarCaidaTelemetria(picoImpactoG);
    Serial.println(F("[EVENT][SYSTEM] CAIDA CONFIRMADA; alerta remota encolada"));
  }
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
  forzarPantallaTemporalmente();
  estadoDeteccionCaida = EstadoDeteccionCaida::INACTIVA;
  verificandoCaida = false;
  caidaConfirmada = false;
  segundosCuentaRegresivaCaida = 0;
  alertaImpactoActiva = false;
  MotionService::rearmImpactDemo();
  modoActual = ModoSistema::ALERTA_SOS;
  pantallaSucia = true;
  reportePantallaPendiente = true;
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
  reportePantallaPendiente = true;
  Serial.println(F("[INFO][SYSTEM] Aviso SOS cerrado"));
}

static inline void procesarOkRemoto() {
  if (!consumirOkRemotoPendiente()) return;

  if (alertaImpactoActiva) {
    finalizarAlertaImpacto();
    Serial.println(F("[INFO][REMOTE] OK cerro alerta de impacto"));
  } else if (alertaSosActiva) {
    finalizarAlertaSos();
    Serial.println(F("[INFO][REMOTE] OK cerro alerta SOS"));
  } else {
    // Una entrada remota nunca navega por pantallas normales: se limita a
    // reconocer alertas para no ejecutar acciones ambiguas a distancia.
    reportePantallaPendiente = true;
    Serial.println(F("[INFO][REMOTE] OK recibido sin alerta activa"));
  }
}

// Diagnostico manual solicitado mediante OK largo. Esta operacion puede tardar
// algunos cientos de ms porque reinicializa fisicamente los dispositivos; solo
// ocurre por accion explicita del usuario, no dentro del muestreo normal.
static inline void ejecutarDiagnosticoManualSensores() {
  if (alertaImpactoActiva) return;

  Serial.println(F("[INFO][SYSTEM] Diagnostico manual de sensores"));

  I2CBusService::restoreConfig();
  MotionService::diagnoseAndReconnect();
  PPGService::forceReconnect();

  // La libreria MAX3010x puede tocar la configuracion del bus. Se restablece la
  // frecuencia comun y se verifica que la IMU siga accesible.
  I2CBusService::restoreConfig();
  if (!MotionService::revalidate()) {
    MotionService::forceReconnect();
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

  forzarPantallaTemporalmente();

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
    if (modoActual == ModoSistema::MENSAJERIA) {
      if (volverPasoMensajeria()) irAlMenu();
      return;
    }
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
      else if (modoActual == ModoSistema::MENSAJERIA) {
        if (confirmarPasoMensajeria()) irAlMenu();
      }
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
        registrarCambioLocalPantalla();
        break;
      case '2':
        modoActual = ModoSistema::DIAGNOSTICO_MOVIMIENTO;
        pantallaSucia = true;
        registrarCambioLocalPantalla();
        break;
      case '3':
        modoActual = ModoSistema::ESTADO_SISTEMA;
        pantallaSucia = true;
        registrarCambioLocalPantalla();
        break;
      case '4':
        modoActual = ModoSistema::MEDICACION;
        pantallaSucia = true;
        registrarCambioLocalPantalla();
        break;
      case '5':
        modoActual = ModoSistema::MENSAJERIA;
        iniciarFlujoMensajeria();
        registrarCambioLocalPantalla();
        break;
      case 'P':
      case 'p': {
        const PPGDiagnostics &ppg = PPGService::diagnostics();
        const PPGSample &muestra = PPGService::latestSample();
        const HeartRateResult &hr = PPGService::heartRate();
        const SpO2Result &spo2 = PPGService::spo2();
        Serial.printf(
          "[DIAG][PPG] ready=%u part=0x%02X sesion=%s contacto=%u red=%lu ir=%lu led=%u hr=%s(%ld/%d) spo2=%s calidad=%s razones=0x%04X muestras=%lu check=%u avail=%u rptr=%u wptr=%u ovf=%u drops=%lu modIR=%.3f modR=%.3f maxim=%ld/%d\n",
          PPGService::isReady() ? 1u : 0u,
          (unsigned)ppg.partId,
          nombreSesionPPG(PPGService::sessionState()),
          ppg.contact ? 1u : 0u,
          (unsigned long)muestra.red,
          (unsigned long)muestra.ir,
          (unsigned)ppg.ledAmplitude,
          nombreEstadoHR(hr.status),
          (long)ppg.maximHeartRate,
          (int)ppg.maximHeartRateValid,
          nombreEstadoSpO2(spo2.status),
          nombreCalidad(hr.quality),
          (unsigned)hr.qualityReasons,
          (unsigned long)ppg.samplesProcessed,
          (unsigned)ppg.lastCheckCount,
          (unsigned)ppg.lastAvailable,
          (unsigned)ppg.hwReadPointer,
          (unsigned)ppg.hwWritePointer,
          (unsigned)ppg.hwOverflowCounter,
          (unsigned long)ppg.suspectedSoftwareDrops,
          ppg.modulationIndexIR,
          ppg.modulationIndexRed,
          (long)ppg.maximSpo2,
          (int)ppg.maximSpo2Valid
        );
        break;
      }
      case 'R':
      case 'r':
        ejecutarDiagnosticoManualSensores();
        break;
      case 'I':
      case 'i': {
        const MotionDiagnostics &imu = MotionService::diagnostics();
        const PPGDiagnostics &ppg = PPGService::diagnostics();
        Serial.printf(
          "[DIAG][BIOSYS] loopMax=%lu ppgGapMax=%lu ppgDrops=%lu imuMiss=%lu imuJitter=%lu\n",
          (unsigned long)runtimeMetrics.loopMaxUs,
          (unsigned long)runtimeMetrics.ppgServiceGapMaxUs,
          (unsigned long)ppg.suspectedSoftwareDrops,
          (unsigned long)imu.missedDeadlines,
          (unsigned long)imu.maxAbsJitterUs
        );
        break;
      }
      default:
        Serial.println(F("0=menu 1=signos 2=IMU 3=estado 4=medicacion 5=mensajeria R=test I=sistema P=PPG"));
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

  // [BIOSYS-C3] Estado compartido antes de iniciar UI, sensores y red.
  inicializarEstadoSistema();
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
  systemHealth.displayReady = true;
  inicializarControlRemotoPantalla();

  modoActual = ModoSistema::SPLASH;
  instanteInicioSplash = millis();
  dibujarSplash();
  pantallaSucia = false;

  // [BIOSYS-C4] Un solo propietario del bus y una sola instancia por sensor.
  I2CBusService::begin();
  MotionService::begin();
  PPGService::begin();

  // Reestablece contrato comun de I2C despues de inicializar MAX30102.
  I2CBusService::restoreConfig();
  if (!MotionService::revalidate()) {
    MotionService::forceReconnect();
  }

  // Mantener OK durante el encendido borra la red anterior y abre el portal.
  prepararConfiguracionWiFi(borrarRedWiFi);

  // La sincronizacion HTTPS corre en el otro nucleo y no bloquea los sensores.
  inicializarSincronizacionMedicacion();
  inicializarTelemetria();
  BioResearch::begin();

  Serial.printf(
    "[READY] VitalWatch %s %s | incluye %s %s + %s %s | role=%s\n",
    VitalWatchConfig::FAMILIA_PRODUCTO,
    VitalWatchConfig::VERSION_PRODUCTO,
    VitalWatchConfig::FAMILIA_SISTEMA,
    VitalWatchConfig::VERSION_SISTEMA,
    VitalWatchConfig::FAMILIA_BIOMEDICA,
    VitalWatchConfig::VERSION_BIOMEDICA,
    VitalWatchConfig::ROL_BUILD
  );
  Serial.println(F("[INFO] Capa conectada SYS y servicios biomédicos BIO integrados"));
  Serial.println(F("[INFO] PPG e IMU se procesan siempre en segundo plano"));
}

// ============================================================================
// LOOP COOPERATIVO
// ============================================================================
void loop() {
  const uint32_t inicioLoopUs = micros();
  // 1) Aplica en este nucleo las ordenes que llegaron desde Supabase.
  procesarControlRemotoPantalla();
  procesarOkRemoto();

  // 2) Entrada de usuario.
  procesarBotonesSistema();
  procesarSerie();

  // 3) Sensores. Ambos se atienden SIEMPRE, independientemente de la vista.
  MotionService::update();
  PPGService::update();
  procesarCambiosMedicacion();
  if (consumirCambioInterfazMensajeria() && modoActual == ModoSistema::MENSAJERIA) {
    pantallaSucia = true;
  }
  procesarAvisoMedicacionVisual();
  procesarCambiosConfiguracionWiFi();
  procesarTelemetriaPeriodica();
  procesarDeteccionCaida();

  // 4) Eventos de mayor prioridad.
  PossibleImpactEvent impacto;
  if (MotionService::consumePossibleImpact(impacto)) {
    if (!alertaImpactoActiva && !alertaSosActiva) {
      picoImpactoG = impacto.peakG;
      activarAlertaImpacto();
    }
  }

  // 5) Fin no bloqueante del splash.
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

  // 6) UI. Redibuja completo solo cuando hace falta y actualiza regiones pequenas
  // (barra/footer) de forma independiente.
  renderizarVistaActual();
  actualizarInterfazPeriodica();
  BioResearch::update();

  registrarDuracionLoop(micros() - inicioLoopUs);

  // Cede tiempo al scheduler interno del ESP32 sin usar delay como temporizador.
  yield();
}
