#ifndef VITALWATCH_CONFIGURACION_WIFI_H
#define VITALWATCH_CONFIGURACION_WIFI_H

#include <Arduino.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WiFi.h>

#include "vitalwatch_config.h"

// [BIOSYS-K1] Portal cautivo, persistencia NVS y reconexión WiFi de SYS 0.9.1.
// El WiFi se configura una sola vez desde el celular y queda guardado en la
// memoria NVS del ESP32. Si la red deja de existir, la pulsera vuelve a abrir
// el portal para permitir elegir otra sin recompilar el firmware.
namespace ConfiguracionWiFi {
  static constexpr const char* ESPACIO_NVS = "vitalwatch";
  static constexpr const char* CLAVE_SSID = "wifi_ssid";
  static constexpr const char* CLAVE_PASSWORD = "wifi_pass";
  static constexpr const char* PASSWORD_PORTAL = "VitalWatch123";
  static constexpr uint32_t TIMEOUT_CONEXION_MS = 12000UL;
  static constexpr uint16_t PUERTO_WEB = 80;
}

static DNSServer servidorDnsWiFi;
static WebServer servidorWebWiFi(ConfiguracionWiFi::PUERTO_WEB);
static char nombrePortalWiFi[33] = "VitalWatch-Setup";
static String opcionesRedesWiFi;
static String nuevoSsidWiFi;
static String nuevoPasswordWiFi;
static volatile bool portalConfiguracionWiFiActivo = false;
static volatile bool credencialesWiFiRecibidas = false;
static volatile bool cambioInterfazWiFiPendiente = false;
static bool forzarPortalWiFiAlArrancar = false;
static bool rutasPortalWiFiRegistradas = false;

static inline bool configurandoWiFiDesdeCelular() {
  return portalConfiguracionWiFiActivo;
}

static inline const char* obtenerNombrePortalWiFi() {
  return nombrePortalWiFi;
}

static inline const char* obtenerPasswordPortalWiFi() {
  return ConfiguracionWiFi::PASSWORD_PORTAL;
}

static inline bool consumirCambioInterfazWiFi() {
  if (!cambioInterfazWiFiPendiente) return false;
  cambioInterfazWiFiPendiente = false;
  return true;
}

static inline bool valorWiFiEsEjemplo(const String &valor) {
  if (valor.isEmpty()) return true;

  String mayusculas = valor;
  mayusculas.toUpperCase();
  return mayusculas.startsWith("NOMBRE_DE_TU_WIFI") ||
         mayusculas.startsWith("CLAVE_DE_TU_WIFI") ||
         mayusculas.startsWith("CONTRASENA_WIFI") ||
         mayusculas.startsWith("TU_") ||
         mayusculas.startsWith("YOUR_") ||
         mayusculas.startsWith("CAMBIAR") ||
         mayusculas.startsWith("REEMPLAZAR");
}

static inline bool cargarCredencialesWiFi(String &ssid, String &password) {
  Preferences preferencias;
  if (!preferencias.begin(ConfiguracionWiFi::ESPACIO_NVS, true)) return false;

  ssid = preferencias.getString(ConfiguracionWiFi::CLAVE_SSID, "");
  password = preferencias.getString(ConfiguracionWiFi::CLAVE_PASSWORD, "");
  preferencias.end();
  return !ssid.isEmpty();
}

static inline bool guardarCredencialesWiFi(
  const String &ssid,
  const String &password
) {
  Preferences preferencias;
  if (!preferencias.begin(ConfiguracionWiFi::ESPACIO_NVS, false)) return false;

  const bool ssidGuardado =
    preferencias.putString(ConfiguracionWiFi::CLAVE_SSID, ssid) > 0;
  preferencias.putString(ConfiguracionWiFi::CLAVE_PASSWORD, password);
  preferencias.end();
  return ssidGuardado;
}

static inline void borrarCredencialesWiFi() {
  Preferences preferencias;
  if (preferencias.begin(ConfiguracionWiFi::ESPACIO_NVS, false)) {
    preferencias.clear();
    preferencias.end();
  }

  // Tambien borra cualquier red recordada internamente por el nucleo ESP32.
  WiFi.disconnect(true, true);
  Serial.println(F("[INFO][WIFI] Credenciales guardadas eliminadas"));
}

static inline String escaparHtmlWiFi(String texto) {
  texto.replace("&", "&amp;");
  texto.replace("<", "&lt;");
  texto.replace(">", "&gt;");
  texto.replace("\"", "&quot;");
  texto.replace("'", "&#39;");
  return texto;
}

static inline void escanearRedesParaPortal() {
  opcionesRedesWiFi = "";
  const int cantidad = WiFi.scanNetworks(false, true);

  for (int indice = 0; indice < cantidad; ++indice) {
    const String ssid = escaparHtmlWiFi(WiFi.SSID(indice));
    opcionesRedesWiFi += F("<option value=\"");
    opcionesRedesWiFi += ssid;
    opcionesRedesWiFi += F("\">");
    opcionesRedesWiFi += ssid;
    opcionesRedesWiFi += F(" (");
    opcionesRedesWiFi += WiFi.RSSI(indice);
    opcionesRedesWiFi += F(" dBm)</option>");
  }

  WiFi.scanDelete();
}

static inline String construirPaginaPortalWiFi() {
  String pagina;
  pagina.reserve(3600 + opcionesRedesWiFi.length());
  pagina += F(
    "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    "<title>VitalWatch WiFi</title><style>"
    "body{font-family:Arial,sans-serif;background:#f4f8fa;color:#10232b;margin:0;padding:24px}"
    "main{max-width:440px;margin:auto;background:white;padding:22px;border:1px solid #cddce2;border-radius:8px}"
    "h1{font-size:26px;margin:0 0 8px;color:#087f9b}p{line-height:1.45}"
    "label{display:block;font-weight:700;margin:18px 0 6px}"
    "input,select,button{box-sizing:border-box;width:100%;min-height:48px;font-size:17px;border-radius:6px}"
    "input,select{border:1px solid #82959d;padding:10px;background:white}"
    "button{border:0;background:#087f9b;color:white;font-weight:700;margin-top:22px}"
    "small{display:block;color:#52656d;margin-top:14px}</style></head><body><main>"
    "<h1>VitalWatch</h1><p>Selecciona la red WiFi donde funcionara la pulsera.</p>"
    "<form method=\"post\" action=\"/guardar\">"
    "<label for=\"ssid\">Red WiFi</label><select id=\"ssid\" name=\"ssid\" required>"
    "<option value=\"\">Seleccionar...</option>"
  );
  pagina += opcionesRedesWiFi;
  pagina += F(
    "</select><label for=\"password\">Contrasena</label>"
    "<input id=\"password\" name=\"password\" type=\"password\" maxlength=\"63\" autocomplete=\"new-password\">"
    "<button type=\"submit\">Guardar y conectar</button></form>"
    "<small>La contrasena queda guardada solamente dentro del ESP32.</small>"
    "</main></body></html>"
  );
  return pagina;
}

static inline void responderPortalWiFi() {
  servidorWebWiFi.sendHeader("Cache-Control", "no-store");
  servidorWebWiFi.send(200, "text/html; charset=utf-8", construirPaginaPortalWiFi());
}

static inline void guardarFormularioPortalWiFi() {
  const String ssid = servidorWebWiFi.arg("ssid");
  const String password = servidorWebWiFi.arg("password");

  if (ssid.isEmpty() || ssid.length() > 32 || password.length() > 63) {
    servidorWebWiFi.send(
      400,
      "text/plain; charset=utf-8",
      "Los datos WiFi no son validos. Vuelve atras e intenta otra vez."
    );
    return;
  }

  if (!guardarCredencialesWiFi(ssid, password)) {
    servidorWebWiFi.send(
      500,
      "text/plain; charset=utf-8",
      "No se pudieron guardar los datos. Reinicia la pulsera e intenta nuevamente."
    );
    return;
  }

  nuevoSsidWiFi = ssid;
  nuevoPasswordWiFi = password;
  credencialesWiFiRecibidas = true;
  servidorWebWiFi.send(
    200,
    "text/html; charset=utf-8",
    "<!doctype html><html lang=\"es\"><meta charset=\"utf-8\">"
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    "<body style=\"font-family:Arial;padding:30px\"><h1>WiFi guardado</h1>"
    "<p>VitalWatch intentara conectarse. Ya puedes cerrar esta pagina.</p></body></html>"
  );
  Serial.print(F("[INFO][WIFI] Nueva red recibida: "));
  Serial.println(ssid);
}

static inline void registrarRutasPortalWiFi() {
  if (rutasPortalWiFiRegistradas) return;
  rutasPortalWiFiRegistradas = true;

  servidorWebWiFi.on("/", HTTP_GET, responderPortalWiFi);
  servidorWebWiFi.on("/portal", HTTP_GET, responderPortalWiFi);
  servidorWebWiFi.on("/generate_204", HTTP_GET, responderPortalWiFi);
  servidorWebWiFi.on("/hotspot-detect.html", HTTP_GET, responderPortalWiFi);
  servidorWebWiFi.on("/connecttest.txt", HTTP_GET, responderPortalWiFi);
  servidorWebWiFi.on("/guardar", HTTP_POST, guardarFormularioPortalWiFi);
  servidorWebWiFi.onNotFound([]() {
    servidorWebWiFi.sendHeader("Location", "http://192.168.4.1/", true);
    servidorWebWiFi.send(302, "text/plain", "VitalWatch WiFi");
  });
}

static inline bool intentarConexionWiFi(
  const String &ssid,
  const String &password
) {
  if (ssid.isEmpty()) return false;

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.disconnect(false, false);
  vTaskDelay(pdMS_TO_TICKS(100));

  Serial.print(F("[INFO][WIFI] Intentando red: "));
  Serial.println(ssid);
  WiFi.begin(ssid.c_str(), password.c_str());

  const uint32_t inicio = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - inicio < ConfiguracionWiFi::TIMEOUT_CONEXION_MS) {
    vTaskDelay(pdMS_TO_TICKS(250));
  }

  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.print(F("[INFO][WIFI] Conectado, IP "));
  Serial.println(WiFi.localIP());
  return true;
}

static inline bool abrirPortalConfiguracionWiFi() {
  WiFi.mode(WIFI_AP_STA);
  snprintf(
    nombrePortalWiFi,
    sizeof(nombrePortalWiFi),
    "VitalWatch-%.20s",
    DEVICE_CODE
  );

  if (!WiFi.softAP(nombrePortalWiFi, ConfiguracionWiFi::PASSWORD_PORTAL)) {
    Serial.println(F("[ERROR][WIFI] No se pudo crear el portal"));
    return false;
  }

  escanearRedesParaPortal();
  registrarRutasPortalWiFi();
  servidorWebWiFi.begin();
  servidorDnsWiFi.start(53, "*", WiFi.softAPIP());

  credencialesWiFiRecibidas = false;
  portalConfiguracionWiFiActivo = true;
  cambioInterfazWiFiPendiente = true;

  Serial.println(F("[INFO][WIFI] Portal de configuracion activo"));
  Serial.print(F("[INFO][WIFI] Red: "));
  Serial.println(nombrePortalWiFi);
  Serial.println(F("[INFO][WIFI] Abrir http://192.168.4.1"));

  // DNSServer 3.x procesa solicitudes de forma asincrona. El servidor web se
  // atiende aqui, en la tarea de red, mientras sensores y pantalla siguen vivos.
  while (!credencialesWiFiRecibidas && WiFi.status() != WL_CONNECTED) {
    servidorWebWiFi.handleClient();
    vTaskDelay(pdMS_TO_TICKS(10));
  }

  servidorWebWiFi.stop();
  servidorDnsWiFi.stop();
  WiFi.softAPdisconnect(true);
  portalConfiguracionWiFiActivo = false;
  cambioInterfazWiFiPendiente = true;
  vTaskDelay(pdMS_TO_TICKS(250));
  return credencialesWiFiRecibidas || WiFi.status() == WL_CONNECTED;
}

static inline void prepararConfiguracionWiFi(bool borrarRedGuardada) {
  forzarPortalWiFiAlArrancar = borrarRedGuardada;
  if (borrarRedGuardada) borrarCredencialesWiFi();
}

static inline bool conectarWiFiVitalWatch() {
  if (WiFi.status() == WL_CONNECTED) return true;

  String ssidGuardado;
  String passwordGuardado;
  const bool tieneRedGuardada =
    !forzarPortalWiFiAlArrancar &&
    cargarCredencialesWiFi(ssidGuardado, passwordGuardado);

  if (tieneRedGuardada && intentarConexionWiFi(ssidGuardado, passwordGuardado)) {
    return true;
  }

  const String ssidCompilado = WIFI_SSID;
  const String passwordCompilado = WIFI_PASSWORD;
  const bool tieneRedCompilada =
    !forzarPortalWiFiAlArrancar &&
    !valorWiFiEsEjemplo(ssidCompilado) &&
    !valorWiFiEsEjemplo(passwordCompilado);

  if (tieneRedCompilada &&
      ssidCompilado != ssidGuardado &&
      intentarConexionWiFi(ssidCompilado, passwordCompilado)) {
    guardarCredencialesWiFi(ssidCompilado, passwordCompilado);
    Serial.println(F("[INFO][WIFI] Red anterior migrada a la memoria del ESP32"));
    return true;
  }

  forzarPortalWiFiAlArrancar = false;
  if (!abrirPortalConfiguracionWiFi()) return false;
  if (WiFi.status() == WL_CONNECTED) return true;
  return intentarConexionWiFi(nuevoSsidWiFi, nuevoPasswordWiFi);
}

#endif
