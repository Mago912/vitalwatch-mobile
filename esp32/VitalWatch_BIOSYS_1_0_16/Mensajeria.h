#ifndef VITALWATCH_MENSAJERIA_H
#define VITALWATCH_MENSAJERIA_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "Configuracion.h"
#include "Configuracion_WiFi.h"

// ============================================================
// VW-MSG-02 — SINCRONIZACION MINIMA DE CONTACTOS Y SOLICITUDES
//
// NUEVO: recibe solo contact_id + display_name y encola MESSAGE_REQUEST o
// CALL_REQUEST en la misma tarea de red ya existente.
// PRESERVADO: ningun numero llega al ESP32 y no se crea otra tarea que pueda
// competir con el muestreo continuo MAX30102/MPU.
// ============================================================
namespace MensajeriaConfig {
  static constexpr uint8_t MAX_CONTACTOS = 8;
  static constexpr uint32_t INTERVALO_CONTACTOS_MS = 30000UL;
  static constexpr uint32_t TIMEOUT_HTTP_MS = 7000UL;
}

enum class TipoSolicitudMensajeria : uint8_t {
  MENSAJE = 0,
  LLAMADA
};

enum class EstadoMensajeria : uint8_t {
  SIN_WIFI = 0,
  ACTUALIZANDO,
  LISTO,
  PENDIENTE,
  ACEPTADO,
  ERROR
};

struct ContactoVitalWatch {
  uint32_t id;
  char nombre[22];
};

struct SolicitudVitalWatch {
  uint32_t contactId;
  uint32_t eventId;
  TipoSolicitudMensajeria tipo;
};

static ContactoVitalWatch contactosRemotos[MensajeriaConfig::MAX_CONTACTOS] = {};
static uint8_t cantidadContactosRemotos = 0;
static SemaphoreHandle_t mutexContactos = nullptr;
static QueueHandle_t colaSolicitudesMensajeria = nullptr;
static volatile EstadoMensajeria estadoMensajeria = EstadoMensajeria::SIN_WIFI;
static volatile bool actualizarContactosPendiente = true;
static volatile bool interfazMensajeriaPendiente = false;
static uint32_t ultimaSincronizacionContactos = 0;
static uint32_t proximoIntentoSolicitudMs = 0;

static inline void copiarTextoMensajeria(
  char* destino,
  size_t capacidad,
  const char* origen
) {
  if (capacidad == 0) return;
  snprintf(destino, capacidad, "%s", origen == nullptr ? "" : origen);
}

static inline const char* textoEstadoMensajeria() {
  switch (estadoMensajeria) {
    case EstadoMensajeria::ACTUALIZANDO: return "ACTUALIZANDO";
    case EstadoMensajeria::LISTO:        return "CONECTADO";
    case EstadoMensajeria::PENDIENTE:    return "PENDIENTE";
    case EstadoMensajeria::ACEPTADO:     return "ACEPTADO";
    case EstadoMensajeria::ERROR:        return "ERROR DE RED";
    default:                             return "SIN WIFI";
  }
}

static inline uint8_t obtenerCantidadContactos() {
  if (mutexContactos == nullptr) return 0;
  uint8_t cantidad = 0;
  if (xSemaphoreTake(mutexContactos, pdMS_TO_TICKS(20)) == pdTRUE) {
    cantidad = cantidadContactosRemotos;
    xSemaphoreGive(mutexContactos);
  }
  return cantidad;
}

static inline bool obtenerContacto(uint8_t indice, ContactoVitalWatch &resultado) {
  if (mutexContactos == nullptr) return false;
  bool encontrado = false;
  if (xSemaphoreTake(mutexContactos, pdMS_TO_TICKS(20)) == pdTRUE) {
    if (indice < cantidadContactosRemotos) {
      resultado = contactosRemotos[indice];
      encontrado = true;
    }
    xSemaphoreGive(mutexContactos);
  }
  return encontrado;
}

static inline void solicitarActualizacionContactos() {
  actualizarContactosPendiente = true;
  estadoMensajeria = EstadoMensajeria::ACTUALIZANDO;
  interfazMensajeriaPendiente = true;
}

static inline bool encolarSolicitudMensajeria(
  uint32_t contactId,
  TipoSolicitudMensajeria tipo
) {
  if (colaSolicitudesMensajeria == nullptr || contactId == 0) return false;
  SolicitudVitalWatch solicitud = {contactId, esp_random(), tipo};
  if (solicitud.eventId == 0) solicitud.eventId = 1;
  const bool encolada =
    xQueueSend(colaSolicitudesMensajeria, &solicitud, 0) == pdTRUE;
  estadoMensajeria = encolada ? EstadoMensajeria::PENDIENTE : EstadoMensajeria::ERROR;
  interfazMensajeriaPendiente = true;
  return encolada;
}

static inline bool enviarPeticionMensajeria(JsonDocument &documento, String &respuesta) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure clienteSeguro;
  // Se conserva el mismo transporte HTTPS del firmware actual. La instalacion
  // de una CA raiz queda como endurecimiento pendiente del prototipo escolar.
  clienteSeguro.setInsecure();

  HTTPClient http;
  http.setConnectTimeout(MensajeriaConfig::TIMEOUT_HTTP_MS);
  http.setTimeout(MensajeriaConfig::TIMEOUT_HTTP_MS);
  const String endpoint = String(SUPABASE_URL) +
    "/functions/v1/vitalwatch-device-messaging";
  if (!http.begin(clienteSeguro, endpoint)) return false;

  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("x-device-token", DEVICE_TOKEN);

  String cuerpo;
  serializeJson(documento, cuerpo);
  const int codigoHttp = http.POST(cuerpo);
  respuesta = http.getString();
  http.end();

  if (codigoHttp < 200 || codigoHttp >= 300) {
    Serial.print(F("[ERROR][MSG] Supabase HTTP "));
    Serial.println(codigoHttp);
    return false;
  }
  return true;
}

static inline bool sincronizarContactosVitalWatch() {
  estadoMensajeria = EstadoMensajeria::ACTUALIZANDO;
  interfazMensajeriaPendiente = true;

  JsonDocument solicitud;
  solicitud["action"] = "list";
  solicitud["deviceCode"] = DEVICE_CODE;
  String respuesta;
  if (!enviarPeticionMensajeria(solicitud, respuesta)) {
    estadoMensajeria = WiFi.status() == WL_CONNECTED
      ? EstadoMensajeria::ERROR
      : EstadoMensajeria::SIN_WIFI;
    interfazMensajeriaPendiente = true;
    return false;
  }

  JsonDocument documento;
  if (deserializeJson(documento, respuesta)) {
    estadoMensajeria = EstadoMensajeria::ERROR;
    interfazMensajeriaPendiente = true;
    return false;
  }

  ContactoVitalWatch nuevos[MensajeriaConfig::MAX_CONTACTOS] = {};
  const JsonArray lista = documento["contacts"].as<JsonArray>();
  const uint8_t cantidad = min(
    (uint8_t)lista.size(),
    MensajeriaConfig::MAX_CONTACTOS
  );
  for (uint8_t indice = 0; indice < cantidad; ++indice) {
    const JsonObject item = lista[indice];
    nuevos[indice].id = (uint32_t)strtoul(item["id"] | "0", nullptr, 10);
    copiarTextoMensajeria(
      nuevos[indice].nombre,
      sizeof(nuevos[indice].nombre),
      item["displayName"] | "Sin nombre"
    );
  }

  if (xSemaphoreTake(mutexContactos, pdMS_TO_TICKS(200)) != pdTRUE) {
    estadoMensajeria = EstadoMensajeria::ERROR;
    return false;
  }
  memcpy(contactosRemotos, nuevos, sizeof(nuevos));
  cantidadContactosRemotos = cantidad;
  xSemaphoreGive(mutexContactos);

  estadoMensajeria = EstadoMensajeria::LISTO;
  interfazMensajeriaPendiente = true;
  Serial.printf("[INFO][MSG] Contactos minimizados sincronizados: %u\n", (unsigned)cantidad);
  return true;
}

static inline bool enviarSolicitudMensajeria(const SolicitudVitalWatch &solicitudPendiente) {
  JsonDocument solicitud;
  solicitud["action"] = "request";
  solicitud["deviceCode"] = DEVICE_CODE;
  solicitud["contactId"] = solicitudPendiente.contactId;
  solicitud["eventType"] = solicitudPendiente.tipo == TipoSolicitudMensajeria::LLAMADA
    ? "CALL_REQUEST"
    : "MESSAGE_REQUEST";
  char eventId[32];
  snprintf(
    eventId,
    sizeof(eventId),
    "msg-%08lx-%08lx",
    (unsigned long)solicitudPendiente.eventId,
    (unsigned long)solicitudPendiente.contactId
  );
  solicitud["eventId"] = eventId;
  const time_t ahora = time(nullptr);
  if (ahora >= 1700000000) solicitud["eventOccurredAt"] = (uint64_t)ahora;

  String respuesta;
  const bool aceptada = enviarPeticionMensajeria(solicitud, respuesta);
  estadoMensajeria = aceptada ? EstadoMensajeria::ACEPTADO : EstadoMensajeria::ERROR;
  interfazMensajeriaPendiente = true;
  Serial.println(
    aceptada
      ? F("[INFO][MSG] Solicitud aceptada por Supabase")
      : F("[ERROR][MSG] Solicitud pendiente no confirmada")
  );
  return aceptada;
}

// Se invoca desde vitalwatch_med (core 0), nunca desde loop() de sensores.
static inline void procesarSincronizacionMensajeria() {
  if (WiFi.status() != WL_CONNECTED) {
    estadoMensajeria = EstadoMensajeria::SIN_WIFI;
    return;
  }

  SolicitudVitalWatch solicitud;
  if ((int32_t)(millis() - proximoIntentoSolicitudMs) >= 0 &&
      xQueueReceive(colaSolicitudesMensajeria, &solicitud, 0) == pdTRUE) {
    if (!enviarSolicitudMensajeria(solicitud)) {
      // Un unico reintento queda en RAM. La clave de idempotencia evita duplicar
      // el evento si la respuesta se perdio despues de insertarlo.
      xQueueSendToFront(colaSolicitudesMensajeria, &solicitud, 0);
      proximoIntentoSolicitudMs = millis() + 5000UL;
    } else {
      proximoIntentoSolicitudMs = 0;
    }
    return;
  }

  if (actualizarContactosPendiente || ultimaSincronizacionContactos == 0 ||
      millis() - ultimaSincronizacionContactos >= MensajeriaConfig::INTERVALO_CONTACTOS_MS) {
    actualizarContactosPendiente = false;
    sincronizarContactosVitalWatch();
    ultimaSincronizacionContactos = millis();
  }
}

static inline bool inicializarMensajeriaVitalWatch() {
  mutexContactos = xSemaphoreCreateMutex();
  colaSolicitudesMensajeria = xQueueCreate(4, sizeof(SolicitudVitalWatch));
  if (mutexContactos == nullptr || colaSolicitudesMensajeria == nullptr) {
    estadoMensajeria = EstadoMensajeria::ERROR;
    return false;
  }
  solicitarActualizacionContactos();
  return true;
}

static inline bool consumirCambioInterfazMensajeria() {
  if (!interfazMensajeriaPendiente) return false;
  interfazMensajeriaPendiente = false;
  return true;
}

// ============================================================
// FIN VW-MSG-02
// ============================================================

#endif
