#ifndef VITALWATCH_SINCRONIZACION_MEDICACION_H
#define VITALWATCH_SINCRONIZACION_MEDICACION_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include "Control_Remoto.h"
#include <HTTPClient.h>
#include <Preferences.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "Configuracion.h"
#include "Configuracion_WiFi.h"
#include "Mensajeria.h"

// [BIOSYS-M1] Sincronización HTTPS, medicación y control remoto de SYS 0.9.5.
// La red se ejecuta en una tarea separada. De esta manera una conexion HTTPS
// lenta no interrumpe el muestreo continuo del MAX30102 ni del MPU.
namespace MedicacionConfig {
  static constexpr uint8_t MAX_MEDICAMENTOS = 8;
  static constexpr uint32_t INTERVALO_CONTROL_PANTALLA_MS = 1000UL;
  static constexpr uint32_t INTERVALO_SINCRONIZACION_MS = 5000UL;
  static constexpr uint32_t INTERVALO_RECONEXION_WIFI_MS = 5000UL;
  static constexpr uint32_t TIMEOUT_HTTP_MS = 7000UL;
  static constexpr uint16_t TAMANO_PILA_TAREA = 16384;
  static constexpr uint8_t MAX_EVENTOS_PERSISTENTES = 8;
  static constexpr uint32_t VERSION_COLA_EVENTOS = 0x010006UL;
}

enum class EstadoSincronizacion : uint8_t {
  SIN_WIFI = 0,
  CONECTANDO,
  CONFIGURANDO_WIFI,
  SINCRONIZANDO,
  LISTO,
  ERROR
};

enum class TipoAccionMedicacion : uint8_t {
  ACTUALIZAR = 0,
  CAMBIAR_ESTADO,
  ENVIAR_TELEMETRIA
};

enum class TipoEventoTelemetria : uint8_t {
  NINGUNO = 0,
  CAIDA,
  SOS
};

struct MedicamentoVitalWatch {
  uint32_t id;
  char nombre[30];
  char dosis[20];
  char fecha[11];
  char hora[6];
  bool tomado;
  bool recordatorioPendiente;
};

struct TelemetriaVitalWatch {
  uint32_t eventId;
  uint64_t eventEpoch;
  int16_t frecuenciaCardiaca;
  int16_t spo2;
  int16_t bateria;
  float impactoG;
  bool frecuenciaValida;
  bool spo2Valido;
  bool bateriaValida;
  bool impactoValido;
  bool modoRendimiento;
  TipoEventoTelemetria evento;
};

struct AccionMedicacion {
  TipoAccionMedicacion tipo;
  uint32_t medicamentoId;
  bool estadoTomado;
  TelemetriaVitalWatch telemetria;
};

static MedicamentoVitalWatch medicamentosRemotos[MedicacionConfig::MAX_MEDICAMENTOS];
static uint8_t cantidadMedicamentosRemotos = 0;
static SemaphoreHandle_t mutexMedicamentos = nullptr;
static QueueHandle_t colaAccionesMedicacion = nullptr;
static TaskHandle_t tareaMedicacion = nullptr;
static volatile EstadoSincronizacion estadoSincronizacion = EstadoSincronizacion::SIN_WIFI;
static volatile bool interfazMedicacionPendiente = false;
static volatile int8_t indiceAvisoMedicacionPendiente = -1;
static uint32_t ultimoMedicamentoAvisado = 0;
static bool sincronizacionRelojSolicitada = false;
static Preferences preferenciasEventos;
static SemaphoreHandle_t mutexEventosPersistentes = nullptr;

struct ColaEventosPersistentes {
  uint32_t version;
  uint8_t cantidad;
  TelemetriaVitalWatch eventos[MedicacionConfig::MAX_EVENTOS_PERSISTENTES];
};

static ColaEventosPersistentes colaEventosPersistentes = {};

static inline void guardarColaEventosEnNvs() {
  preferenciasEventos.putBytes(
    "cola",
    &colaEventosPersistentes,
    sizeof(colaEventosPersistentes)
  );
}

static inline bool guardarEventoCriticoPersistente(TelemetriaVitalWatch telemetria) {
  if (mutexEventosPersistentes == nullptr) return false;
  if (telemetria.eventId == 0) telemetria.eventId = esp_random();

  if (xSemaphoreTake(mutexEventosPersistentes, pdMS_TO_TICKS(100)) != pdTRUE) return false;
  if (colaEventosPersistentes.cantidad >= MedicacionConfig::MAX_EVENTOS_PERSISTENTES) {
    for (uint8_t i = 1; i < colaEventosPersistentes.cantidad; ++i) {
      colaEventosPersistentes.eventos[i - 1] = colaEventosPersistentes.eventos[i];
    }
    --colaEventosPersistentes.cantidad;
    Serial.println(F("[WARN][TEL] Cola persistente llena; se reemplazo el evento mas antiguo"));
  }
  colaEventosPersistentes.eventos[colaEventosPersistentes.cantidad++] = telemetria;
  guardarColaEventosEnNvs();
  xSemaphoreGive(mutexEventosPersistentes);
  Serial.println(F("[INFO][TEL] Evento critico guardado hasta confirmar su envio"));
  return true;
}

static inline bool obtenerPrimerEventoPersistente(TelemetriaVitalWatch &telemetria) {
  if (mutexEventosPersistentes == nullptr) return false;
  bool disponible = false;
  if (xSemaphoreTake(mutexEventosPersistentes, pdMS_TO_TICKS(100)) == pdTRUE) {
    if (colaEventosPersistentes.cantidad > 0) {
      telemetria = colaEventosPersistentes.eventos[0];
      disponible = true;
    }
    xSemaphoreGive(mutexEventosPersistentes);
  }
  return disponible;
}

static inline void confirmarPrimerEventoPersistente(uint32_t eventId) {
  if (mutexEventosPersistentes == nullptr) return;
  if (xSemaphoreTake(mutexEventosPersistentes, pdMS_TO_TICKS(100)) != pdTRUE) return;
  if (colaEventosPersistentes.cantidad > 0 &&
      colaEventosPersistentes.eventos[0].eventId == eventId) {
    for (uint8_t i = 1; i < colaEventosPersistentes.cantidad; ++i) {
      colaEventosPersistentes.eventos[i - 1] = colaEventosPersistentes.eventos[i];
    }
    --colaEventosPersistentes.cantidad;
    guardarColaEventosEnNvs();
  }
  xSemaphoreGive(mutexEventosPersistentes);
}

static inline void copiarTextoSeguro(
  char* destino,
  size_t capacidad,
  const char* origen
) {
  if (capacidad == 0) return;
  snprintf(destino, capacidad, "%s", origen == nullptr ? "" : origen);
}

static inline const char* textoEstadoSincronizacion() {
  switch (estadoSincronizacion) {
    case EstadoSincronizacion::CONECTANDO:    return "CONECTANDO";
    case EstadoSincronizacion::CONFIGURANDO_WIFI: return "CONFIG WIFI";
    case EstadoSincronizacion::SINCRONIZANDO: return "ACTUALIZANDO";
    case EstadoSincronizacion::LISTO:         return "CONECTADO";
    case EstadoSincronizacion::ERROR:         return "ERROR DE RED";
    default:                                  return "SIN WIFI";
  }
}

static inline bool conexionWiFiDisponible() {
  return WiFi.status() == WL_CONNECTED;
}

static inline uint8_t obtenerCantidadMedicamentos() {
  if (mutexMedicamentos == nullptr) return 0;

  uint8_t cantidad = 0;
  if (xSemaphoreTake(mutexMedicamentos, pdMS_TO_TICKS(20)) == pdTRUE) {
    cantidad = cantidadMedicamentosRemotos;
    xSemaphoreGive(mutexMedicamentos);
  }
  return cantidad;
}

static inline bool obtenerMedicamento(
  uint8_t indice,
  MedicamentoVitalWatch &resultado
) {
  if (mutexMedicamentos == nullptr) return false;

  bool encontrado = false;
  if (xSemaphoreTake(mutexMedicamentos, pdMS_TO_TICKS(20)) == pdTRUE) {
    if (indice < cantidadMedicamentosRemotos) {
      resultado = medicamentosRemotos[indice];
      encontrado = true;
    }
    xSemaphoreGive(mutexMedicamentos);
  }
  return encontrado;
}

static inline bool encolarAccionMedicacion(
  TipoAccionMedicacion tipo,
  uint32_t medicamentoId = 0,
  bool estadoTomado = false
) {
  if (colaAccionesMedicacion == nullptr) return false;

  const AccionMedicacion accion = {tipo, medicamentoId, estadoTomado, {}};
  return xQueueSend(colaAccionesMedicacion, &accion, 0) == pdTRUE;
}

static inline bool solicitarActualizacionMedicamentos() {
  return encolarAccionMedicacion(TipoAccionMedicacion::ACTUALIZAR);
}

static inline bool solicitarEstadoMedicamento(
  uint32_t medicamentoId,
  bool estadoTomado
) {
  return encolarAccionMedicacion(
    TipoAccionMedicacion::CAMBIAR_ESTADO,
    medicamentoId,
    estadoTomado
  );
}

static inline bool solicitarEnvioTelemetria(
  const TelemetriaVitalWatch &telemetria
) {
  if (colaAccionesMedicacion == nullptr) return false;

  if (telemetria.evento != TipoEventoTelemetria::NINGUNO) {
    return guardarEventoCriticoPersistente(telemetria);
  }

  const AccionMedicacion accion = {
    TipoAccionMedicacion::ENVIAR_TELEMETRIA,
    0,
    false,
    telemetria
  };
  return xQueueSend(colaAccionesMedicacion, &accion, 0) == pdTRUE;
}

static inline bool enviarSolicitudMedicacion(
  JsonDocument &solicitud,
  String &respuesta
) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure clienteSeguro;
  // Prototipo escolar: se valida el servidor mediante HTTPS, pero se omite la
  // cadena CA local. Para produccion se debe instalar el certificado raiz.
  clienteSeguro.setInsecure();

  HTTPClient http;
  http.setConnectTimeout(MedicacionConfig::TIMEOUT_HTTP_MS);
  http.setTimeout(MedicacionConfig::TIMEOUT_HTTP_MS);

  const String endpoint = String(SUPABASE_URL) +
    "/functions/v1/vitalwatch-device-medications";

  if (!http.begin(clienteSeguro, endpoint)) return false;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  String cuerpo;
  serializeJson(solicitud, cuerpo);
  const int codigoHttp = http.POST(cuerpo);
  respuesta = http.getString();
  http.end();

  if (codigoHttp < 200 || codigoHttp >= 300) {
    Serial.print(F("[ERROR][MED] Supabase HTTP "));
    Serial.print(codigoHttp);
    Serial.print(F(": "));
    Serial.println(respuesta);
    return false;
  }

  return true;
}

static inline bool guardarRespuestaMedicamentos(const String &respuesta) {
  JsonDocument documento;
  const DeserializationError error = deserializeJson(documento, respuesta);
  if (error) {
    Serial.print(F("[ERROR][MED] JSON invalido: "));
    Serial.println(error.c_str());
    return false;
  }

  const JsonObject control = documento["control"].as<JsonObject>();
  if (!control.isNull() && control["displayOn"].is<bool>()) {
    solicitarControlPantallaRemoto(
      control["displayOn"].as<bool>(),
      control["displayView"] | "menu",
      control["commandAt"] | ""
    );
    solicitarEntradaRemota(control["inputAction"] | "");
  }

  MedicamentoVitalWatch nuevos[MedicacionConfig::MAX_MEDICAMENTOS] = {};
  const JsonArray lista = documento["medications"].as<JsonArray>();
  const uint8_t cantidad = min(
    (uint8_t)lista.size(),
    MedicacionConfig::MAX_MEDICAMENTOS
  );

  for (uint8_t indice = 0; indice < cantidad; ++indice) {
    const JsonObject item = lista[indice];
    const char* idTexto = item["id"] | "0";
    nuevos[indice].id = (uint32_t)strtoul(idTexto, nullptr, 10);
    copiarTextoSeguro(
      nuevos[indice].nombre,
      sizeof(nuevos[indice].nombre),
      item["name"] | "Sin nombre"
    );
    copiarTextoSeguro(
      nuevos[indice].dosis,
      sizeof(nuevos[indice].dosis),
      item["dose"] | ""
    );
    copiarTextoSeguro(
      nuevos[indice].fecha,
      sizeof(nuevos[indice].fecha),
      item["date"] | "----/--/--"
    );
    copiarTextoSeguro(
      nuevos[indice].hora,
      sizeof(nuevos[indice].hora),
      item["time"] | "--:--"
    );
    nuevos[indice].tomado = strcmp(item["status"] | "", "Tomado") == 0;
    nuevos[indice].recordatorioPendiente = item["reminderDue"] | false;
  }

  int8_t nuevoIndiceAviso = -1;
  uint32_t nuevoMedicamentoAvisado = 0;
  for (uint8_t indice = 0; indice < cantidad; ++indice) {
    if (nuevos[indice].recordatorioPendiente && !nuevos[indice].tomado) {
      nuevoIndiceAviso = (int8_t)indice;
      nuevoMedicamentoAvisado = nuevos[indice].id;
      break;
    }
  }

  if (xSemaphoreTake(mutexMedicamentos, pdMS_TO_TICKS(200)) != pdTRUE) {
    return false;
  }

  memcpy(medicamentosRemotos, nuevos, sizeof(nuevos));
  cantidadMedicamentosRemotos = cantidad;
  xSemaphoreGive(mutexMedicamentos);

  if (nuevoIndiceAviso >= 0 && nuevoMedicamentoAvisado != ultimoMedicamentoAvisado) {
    indiceAvisoMedicacionPendiente = nuevoIndiceAviso;
    ultimoMedicamentoAvisado = nuevoMedicamentoAvisado;
    Serial.print(F("[EVENT][MED] Recordatorio visual para ID "));
    Serial.println(nuevoMedicamentoAvisado);
  } else if (nuevoIndiceAviso < 0) {
    ultimoMedicamentoAvisado = 0;
  }

  interfazMedicacionPendiente = true;
  Serial.print(F("[INFO][MED] Medicamentos sincronizados: "));
  Serial.println(cantidad);
  return true;
}

static inline bool guardarRespuestaControlPantalla(const String &respuesta) {
  JsonDocument documento;
  const DeserializationError error = deserializeJson(documento, respuesta);
  if (error) return false;

  const JsonObject control = documento["control"].as<JsonObject>();
  if (control.isNull() || !control["displayOn"].is<bool>()) return false;

  solicitarControlPantallaRemoto(
    control["displayOn"].as<bool>(),
    control["displayView"] | "menu",
    control["commandAt"] | ""
  );
  solicitarEntradaRemota(control["inputAction"] | "");
  return true;
}

static inline bool enviarTelemetriaVitalWatch(
  const TelemetriaVitalWatch &telemetria
) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure clienteSeguro;
  clienteSeguro.setInsecure();

  HTTPClient http;
  http.setConnectTimeout(MedicacionConfig::TIMEOUT_HTTP_MS);
  http.setTimeout(MedicacionConfig::TIMEOUT_HTTP_MS);

  const String endpoint = String(SUPABASE_URL) +
    "/functions/v1/vitalwatch-device-telemetry";

  if (!http.begin(clienteSeguro, endpoint)) return false;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  JsonDocument solicitud;
  solicitud["deviceCode"] = DEVICE_CODE;

  if (telemetria.eventId != 0) {
    char identificador[32];
    snprintf(
      identificador,
      sizeof(identificador),
      "%s-%08lX",
      DEVICE_CODE,
      (unsigned long)telemetria.eventId
    );
    solicitud["eventId"] = identificador;
  }
  if (telemetria.eventEpoch >= 1700000000ULL) {
    solicitud["eventOccurredAt"] = telemetria.eventEpoch;
  }

  if (telemetria.frecuenciaValida) {
    solicitud["heartRate"] = telemetria.frecuenciaCardiaca;
  } else {
    solicitud["heartRate"] = nullptr;
  }

  if (telemetria.spo2Valido) {
    solicitud["spo2"] = telemetria.spo2;
  } else {
    solicitud["spo2"] = nullptr;
  }

  if (telemetria.bateriaValida) {
    solicitud["batteryLevel"] = telemetria.bateria;
  } else {
    solicitud["batteryLevel"] = nullptr;
  }

  if (telemetria.impactoValido) {
    solicitud["impactValue"] = telemetria.impactoG;
  } else {
    solicitud["impactValue"] = nullptr;
  }

  solicitud["performanceMode"] = telemetria.modoRendimiento;

  if (telemetria.evento == TipoEventoTelemetria::CAIDA) {
    solicitud["event"] = "fall_detected";
  } else if (telemetria.evento == TipoEventoTelemetria::SOS) {
    solicitud["event"] = "sos";
  }

  String cuerpo;
  serializeJson(solicitud, cuerpo);
  const int codigoHttp = http.POST(cuerpo);
  const String respuesta = http.getString();
  http.end();

  if (codigoHttp < 200 || codigoHttp >= 300) {
    Serial.print(F("[ERROR][TEL] Supabase HTTP "));
    Serial.print(codigoHttp);
    Serial.print(F(": "));
    Serial.println(respuesta);
    return false;
  }

  Serial.print(F("[INFO][TEL] Telemetria enviada"));
  if (telemetria.evento == TipoEventoTelemetria::CAIDA) {
    Serial.print(F(" + CAIDA"));
  } else if (telemetria.evento == TipoEventoTelemetria::SOS) {
    Serial.print(F(" + SOS"));
  }
  Serial.println();
  return true;
}

static inline bool sincronizarMedicamentos(
  uint32_t medicamentoId = 0,
  bool estadoTomado = false
) {
  estadoSincronizacion = EstadoSincronizacion::SINCRONIZANDO;
  interfazMedicacionPendiente = true;

  JsonDocument solicitud;
  const bool reportarEntradaRemota = entradaRemotaAplicadaSinReportar();
  solicitud["deviceCode"] = DEVICE_CODE;
  solicitud["reportedDisplayOn"] = pantallaRemotaEncendida();
  solicitud["reportedDisplayView"] = vistaPantallaRemotaReportada();
  solicitud["reportedAlertState"] = estadoAlertaRemotaReportado();
  if (reportarEntradaRemota) {
    solicitud["reportedInputHandled"] = true;
  }

  if (medicamentoId == 0) {
    solicitud["action"] = "list";
  } else {
    solicitud["action"] = "set_status";
    solicitud["medicationId"] = medicamentoId;
    solicitud["status"] = estadoTomado ? "taken" : "pending";
  }

  String respuesta;
  if (!enviarSolicitudMedicacion(solicitud, respuesta) ||
      !guardarRespuestaMedicamentos(respuesta)) {
    estadoSincronizacion = EstadoSincronizacion::ERROR;
    interfazMedicacionPendiente = true;
    return false;
  }

  estadoSincronizacion = EstadoSincronizacion::LISTO;
  if (reportarEntradaRemota) {
    confirmarReporteEntradaRemota();
  }
  interfazMedicacionPendiente = true;
  return true;
}

static inline bool sincronizarControlPantalla() {
  JsonDocument solicitud;
  solicitud["deviceCode"] = DEVICE_CODE;
  solicitud["action"] = "control";

  String respuesta;
  return enviarSolicitudMedicacion(solicitud, respuesta) &&
         guardarRespuestaControlPantalla(respuesta);
}

static inline bool conectarWiFiMedicacion() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!sincronizacionRelojSolicitada) {
      // El epoch siempre es UTC; la zona horaria solo se aplica al mostrarlo.
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      sincronizacionRelojSolicitada = true;
      Serial.println(F("[INFO][TIME] Sincronizacion NTP solicitada"));
    }
    return true;
  }

  estadoSincronizacion = EstadoSincronizacion::CONECTANDO;
  interfazMedicacionPendiente = true;
  if (!conectarWiFiVitalWatch()) {
    estadoSincronizacion = EstadoSincronizacion::SIN_WIFI;
    interfazMedicacionPendiente = true;
    return false;
  }

  sincronizacionRelojSolicitada = false;

  return true;
}

static void tareaSincronizacionMedicacion(void* parametro) {
  (void)parametro;
  uint32_t ultimaSincronizacion = 0;
  uint32_t ultimaConsultaControl = 0;

  for (;;) {
    if (!conectarWiFiMedicacion()) {
      vTaskDelay(pdMS_TO_TICKS(MedicacionConfig::INTERVALO_RECONEXION_WIFI_MS));
      continue;
    }

    TelemetriaVitalWatch eventoPersistente;
    if (obtenerPrimerEventoPersistente(eventoPersistente)) {
      if (enviarTelemetriaVitalWatch(eventoPersistente)) {
        confirmarPrimerEventoPersistente(eventoPersistente.eventId);
      } else {
        vTaskDelay(pdMS_TO_TICKS(1000));
      }
      continue;
    }

    AccionMedicacion accion;
    if (xQueueReceive(colaAccionesMedicacion, &accion, 0) == pdTRUE) {
      if (accion.tipo == TipoAccionMedicacion::ENVIAR_TELEMETRIA) {
        enviarTelemetriaVitalWatch(accion.telemetria);
      } else {
        const bool cambiaEstado = accion.tipo == TipoAccionMedicacion::CAMBIAR_ESTADO;
        sincronizarMedicamentos(
          cambiaEstado ? accion.medicamentoId : 0,
          cambiaEstado && accion.estadoTomado
        );
        ultimaSincronizacion = millis();
      }
    } else if (consumirReportePantallaPendiente()) {
      sincronizarMedicamentos();
      ultimaSincronizacion = millis();
      ultimaConsultaControl = ultimaSincronizacion;
    } else if (ultimaConsultaControl == 0 ||
               millis() - ultimaConsultaControl >=
                 MedicacionConfig::INTERVALO_CONTROL_PANTALLA_MS) {
      sincronizarControlPantalla();
      ultimaConsultaControl = millis();
    } else if (ultimaSincronizacion == 0 ||
               millis() - ultimaSincronizacion >=
                 MedicacionConfig::INTERVALO_SINCRONIZACION_MS) {
      sincronizarMedicamentos();
      ultimaSincronizacion = millis();
    }

    // VW-MSG-03 — Comparte esta tarea de red: nunca bloquea loop() ni crea
    // competencia adicional con los sensores biomédicos.
    procesarSincronizacionMensajeria();

    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

static inline void inicializarSincronizacionMedicacion() {
  mutexMedicamentos = xSemaphoreCreateMutex();
  mutexEventosPersistentes = xSemaphoreCreateMutex();
  colaAccionesMedicacion = xQueueCreate(4, sizeof(AccionMedicacion));

  const bool mensajeriaLista = inicializarMensajeriaVitalWatch();

  if (mutexMedicamentos == nullptr || mutexEventosPersistentes == nullptr ||
      colaAccionesMedicacion == nullptr || !mensajeriaLista) {
    estadoSincronizacion = EstadoSincronizacion::ERROR;
    Serial.println(F("[ERROR][MED] No se pudo reservar memoria para sincronizacion"));
    return;
  }

  preferenciasEventos.begin("vw_evt_106", false);
  const size_t bytesGuardados = preferenciasEventos.getBytesLength("cola");
  if (bytesGuardados == sizeof(colaEventosPersistentes)) {
    preferenciasEventos.getBytes("cola", &colaEventosPersistentes, sizeof(colaEventosPersistentes));
  }
  if (colaEventosPersistentes.version != MedicacionConfig::VERSION_COLA_EVENTOS ||
      colaEventosPersistentes.cantidad > MedicacionConfig::MAX_EVENTOS_PERSISTENTES) {
    memset(&colaEventosPersistentes, 0, sizeof(colaEventosPersistentes));
    colaEventosPersistentes.version = MedicacionConfig::VERSION_COLA_EVENTOS;
    guardarColaEventosEnNvs();
  }
  Serial.printf(
    "[INFO][TEL] Eventos criticos pendientes en NVS: %u\n",
    (unsigned)colaEventosPersistentes.cantidad
  );

  const BaseType_t resultado = xTaskCreatePinnedToCore(
    tareaSincronizacionMedicacion,
    "vitalwatch_med",
    MedicacionConfig::TAMANO_PILA_TAREA,
    nullptr,
    1,
    &tareaMedicacion,
    0
  );

  if (resultado != pdPASS) {
    estadoSincronizacion = EstadoSincronizacion::ERROR;
    Serial.println(F("[ERROR][MED] No se pudo iniciar la tarea de red"));
  }
}

static inline void procesarCambiosMedicacion() {
  if (!interfazMedicacionPendiente) return;
  interfazMedicacionPendiente = false;

  if (modoActual == ModoSistema::MEDICACION ||
      modoActual == ModoSistema::ESTADO_SISTEMA ||
      modoActual == ModoSistema::MENU) {
    pantallaSucia = true;
  }
}

static inline bool consumirAvisoMedicacionPendiente(uint8_t &indice) {
  const int8_t aviso = indiceAvisoMedicacionPendiente;
  if (aviso < 0) return false;

  indiceAvisoMedicacionPendiente = -1;
  indice = (uint8_t)aviso;
  return true;
}

static inline void procesarCambiosConfiguracionWiFi() {
  if (!consumirCambioInterfazWiFi()) return;

  if (configurandoWiFiDesdeCelular()) {
    estadoSincronizacion = EstadoSincronizacion::CONFIGURANDO_WIFI;
    if (modoActual == ModoSistema::SPLASH) {
      cambioInterfazWiFiPendiente = true;
      return;
    }

    if (!alertaImpactoActiva && !alertaSosActiva) {
      modoActual = ModoSistema::CONFIGURACION_WIFI;
    }
  } else {
    estadoSincronizacion = WiFi.status() == WL_CONNECTED
      ? EstadoSincronizacion::CONECTANDO
      : EstadoSincronizacion::SIN_WIFI;
    if (modoActual == ModoSistema::CONFIGURACION_WIFI) {
      modoActual = ModoSistema::MENU;
    }
  }

  pantallaSucia = true;
}

#endif
