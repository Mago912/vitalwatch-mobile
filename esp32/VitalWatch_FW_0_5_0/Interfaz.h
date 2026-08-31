#ifndef VITALWATCH_INTERFAZ_H
#define VITALWATCH_INTERFAZ_H

#include <Arduino.h>
#include "Configuracion.h"
#include "Botones.h"
#include "Sensor_Movimiento.h"
#include "Sensor_Oxigeno.h"
#include "LogoVitalWatch.h"

// ============================================================================
// INTERFAZ GRAFICA - ST7735 128x128
//
// Objetivos de esta revision:
// - no escribir fuera de la pantalla;
// - usar el tamano 1 para informacion secundaria y tamano 2 solo para datos
//   centrales, porque la fuente clasica de Adafruit GFX mide aprox. 6x8 px por
//   caracter en tamano 1;
// - conservar alto contraste para lectura sencilla;
// - evitar redibujar la pantalla completa continuamente;
// - mostrar que boton se acaba de accionar durante unos milisegundos;
// - reservar una barra superior fija para clima, bateria y hora.
//
// Clima, bateria y hora tienen API preparada pero no se inventan datos: mientras
// no exista Wi-Fi/NTP y medicion real de bateria, se muestran "--".
// ============================================================================

namespace InterfazConfig {
  static constexpr int16_t ANCHO = 128;
  static constexpr int16_t ALTO = 128;
  static constexpr int16_t ALTO_BARRA_SUPERIOR = 12;
  static constexpr int16_t Y_CONTENIDO = 14;
  static constexpr int16_t Y_FOOTER = 117;
  static constexpr int16_t ALTO_FOOTER = 11;
  static constexpr uint8_t CANTIDAD_ITEMS_MENU = 3;
}

struct DatosBarraSuperior {
  bool climaValido;
  int temperaturaC;
  bool bateriaValida;
  int bateriaPorcentaje;
  bool horaValida;
  uint8_t hora;
  uint8_t minuto;
};

static DatosBarraSuperior datosBarra = {
  false, 0,
  false, 0,
  false, 0, 0
};

static uint8_t indiceMenu = 0;
static char textoBotonReciente[8] = "";
static uint32_t hastaIndicadorBoton = 0;
static uint32_t ultimoRefrescoBarra = 0;

static inline void textoCentrado(
  const char* texto,
  int16_t y,
  uint8_t tamano,
  uint16_t color,
  uint16_t fondo = VW_NEGRO
) {
  int16_t x1, y1;
  uint16_t ancho, alto;

  tft.setTextSize(tamano);
  tft.setTextWrap(false);
  tft.getTextBounds(texto, 0, y, &x1, &y1, &ancho, &alto);

  int16_t x = (tft.width() - (int16_t)ancho) / 2;
  if (x < 0) x = 0;

  tft.setTextColor(color, fondo);
  tft.setCursor(x, y);
  tft.print(texto);
}

static inline void textoCentradoEnZona(
  const char* texto,
  int16_t x,
  int16_t anchoZona,
  int16_t y,
  uint8_t tamano,
  uint16_t color,
  uint16_t fondo
) {
  int16_t x1, y1;
  uint16_t ancho, alto;
  tft.setTextSize(tamano);
  tft.setTextWrap(false);
  tft.getTextBounds(texto, 0, y, &x1, &y1, &ancho, &alto);

  int16_t px = x + (anchoZona - (int16_t)ancho) / 2;
  if (px < x) px = x;

  tft.setTextColor(color, fondo);
  tft.setCursor(px, y);
  tft.print(texto);
}

static inline void limpiarContenido() {
  tft.fillRect(
    0,
    InterfazConfig::Y_CONTENIDO,
    tft.width(),
    InterfazConfig::Y_FOOTER - InterfazConfig::Y_CONTENIDO,
    VW_NEGRO
  );
}

static inline void establecerClimaLocal(int temperaturaC, bool valido = true) {
  datosBarra.temperaturaC = temperaturaC;
  datosBarra.climaValido = valido;
}

static inline void establecerBateria(int porcentaje, bool valido = true) {
  datosBarra.bateriaPorcentaje = constrain(porcentaje, 0, 100);
  datosBarra.bateriaValida = valido;
}

static inline void establecerHora(uint8_t hora, uint8_t minuto, bool valido = true) {
  datosBarra.hora = hora % 24;
  datosBarra.minuto = minuto % 60;
  datosBarra.horaValida = valido;
}

static inline void dibujarBarraSuperior() {
  if (modoActual == ModoSistema::SPLASH ||
      modoActual == ModoSistema::ALERTA_IMPACTO) {
    return;
  }

  char clima[8];
  char bateria[8];
  char hora[8];

  if (datosBarra.climaValido) {
    snprintf(clima, sizeof(clima), "%dC", datosBarra.temperaturaC);
  } else {
    snprintf(clima, sizeof(clima), "--C");
  }

  if (datosBarra.bateriaValida) {
    snprintf(bateria, sizeof(bateria), "%d%%", datosBarra.bateriaPorcentaje);
  } else {
    snprintf(bateria, sizeof(bateria), "--%%");
  }

  if (datosBarra.horaValida) {
    snprintf(hora, sizeof(hora), "%02u:%02u", datosBarra.hora, datosBarra.minuto);
  } else {
    snprintf(hora, sizeof(hora), "--:--");
  }

  tft.fillRect(0, 0, tft.width(), InterfazConfig::ALTO_BARRA_SUPERIOR, VW_AZUL_OSCURO);
  tft.drawFastHLine(0, InterfazConfig::ALTO_BARRA_SUPERIOR - 1, tft.width(), VW_AZUL);

  // Tres zonas equilibradas dentro de los 128 px disponibles.
  textoCentradoEnZona(clima,    0,  39, 2, 1, VW_CIAN,   VW_AZUL_OSCURO);
  textoCentradoEnZona(bateria, 40,  41, 2, 1, VW_BLANCO, VW_AZUL_OSCURO);
  textoCentradoEnZona(hora,    82,  46, 2, 1, VW_BLANCO, VW_AZUL_OSCURO);
}

static inline void dibujarMarcaVitalWatch(int16_t y, uint8_t tamano = 2) {
  // "VitalWatch" en tamano 2 ocupa aproximadamente 120 px, justo dentro de
  // la pantalla de 128 px. Se separa por color para conservar la identidad.
  const int16_t x = tamano == 2 ? 4 : 34;
  tft.setTextSize(tamano);
  tft.setTextWrap(false);
  tft.setTextColor(VW_BLANCO, VW_NEGRO);
  tft.setCursor(x, y);
  tft.print(F("Vital"));
  tft.setTextColor(VW_CIAN, VW_NEGRO);
  tft.print(F("Watch"));
}

static inline void dibujarSplash() {
  tft.fillScreen(VW_NEGRO);

  const int16_t xLogo = (tft.width() - LOGO_CORAZON_ANCHO) / 2;
  tft.drawRGBBitmap(
    xLogo,
    17,
    LOGO_CORAZON_RGB565,
    LOGO_CORAZON_ANCHO,
    LOGO_CORAZON_ALTO
  );

  dibujarMarcaVitalWatch(84, 2);
  textoCentrado("Iniciando...", 109, 1, VW_GRIS);
}

static inline const char* tituloMenu(uint8_t indice) {
  switch (indice) {
    case 0: return "SIGNOS";
    case 1: return "MOVIMIENTO";
    case 2: return "ESTADO";
    default: return "MENU";
  }
}

static inline const char* descripcionMenu(uint8_t indice) {
  switch (indice) {
    case 0: return "Pulso y SpO2";
    case 1: return "Revisar sensor IMU";
    case 2: return "Estado del equipo";
    default: return "";
  }
}

static inline ModoSistema modoSeleccionadoMenu() {
  switch (indiceMenu) {
    case 0: return ModoSistema::SIGNOS_VITALES;
    case 1: return ModoSistema::DIAGNOSTICO_MOVIMIENTO;
    case 2: return ModoSistema::ESTADO_SISTEMA;
    default: return ModoSistema::SIGNOS_VITALES;
  }
}

static inline void menuAnterior() {
  indiceMenu = (indiceMenu + InterfazConfig::CANTIDAD_ITEMS_MENU - 1) %
               InterfazConfig::CANTIDAD_ITEMS_MENU;
  pantallaSucia = true;
}

static inline void menuSiguiente() {
  indiceMenu = (indiceMenu + 1) % InterfazConfig::CANTIDAD_ITEMS_MENU;
  pantallaSucia = true;
}

static inline void dibujarMenu() {
  tft.fillScreen(VW_NEGRO);
  dibujarBarraSuperior();

  const int16_t xLogo = (tft.width() - LOGO_CORAZON_ANCHO) / 2;
  tft.drawRGBBitmap(
    xLogo,
    25,
    LOGO_CORAZON_TENUE_RGB565,
    LOGO_CORAZON_ANCHO,
    LOGO_CORAZON_ALTO
  );

  // Una unica opcion grande por vez: mas facil de leer que tres filas pequenas.
  textoCentrado(tituloMenu(indiceMenu), 62, 2, VW_BLANCO);
  textoCentrado(descripcionMenu(indiceMenu), 88, 1, VW_CIAN);

  char pagina[8];
  snprintf(pagina, sizeof(pagina), "%u/3", (unsigned)(indiceMenu + 1));
  textoCentrado(pagina, 101, 1, VW_GRIS);
}

static inline uint16_t colorEstado(bool ok) {
  return ok ? VW_VERDE : VW_ROJO;
}

static inline void dibujarEstadoSistema() {
  tft.fillScreen(VW_NEGRO);
  dibujarBarraSuperior();
  textoCentrado("ESTADO DEL EQUIPO", 16, 1, VW_CIAN);

  tft.setTextSize(1);
  tft.setTextWrap(false);

  tft.setTextColor(VW_BLANCO, VW_NEGRO);
  tft.setCursor(7, 37);
  tft.print(F("IMU"));
  tft.setCursor(84, 37);
  tft.setTextColor(colorEstado(mpuDisponible), VW_NEGRO);
  tft.print(mpuDisponible ? F("OK") : F("ERROR"));

  tft.setTextColor(VW_BLANCO, VW_NEGRO);
  tft.setCursor(7, 53);
  tft.print(F("MAX30102"));
  tft.setCursor(84, 53);
  tft.setTextColor(colorEstado(max30102Disponible), VW_NEGRO);
  tft.print(max30102Disponible ? F("OK") : F("ERROR"));

  tft.setTextColor(VW_GRIS, VW_NEGRO);
  tft.setCursor(7, 71);
  tft.print(F("I2C  SDA21 SCL22"));

  tft.setCursor(7, 84);
  tft.print(F("FW "));
  tft.print(VitalWatchConfig::VERSION_FIRMWARE);

  tft.setCursor(7, 97);
  if (!mpuDisponible) {
    tft.print(F("IMU: "));
    tft.print(detalleErrorMPU);
  } else if (!max30102Disponible) {
    tft.print(F("PPG: "));
    tft.print(detalleErrorMAX30102);
  } else {
    tft.print(F("Sensores operativos"));
  }
}

static inline void dibujarDiagnosticoMovimiento() {
  tft.fillScreen(VW_NEGRO);
  dibujarBarraSuperior();
  textoCentrado("MOVIMIENTO", 16, 1, VW_CIAN);

  if (!mpuDisponible || !movimientoActual.valida) {
    textoCentrado("IMU NO DISPONIBLE", 43, 1, VW_ROJO);
    textoCentrado(detalleErrorMPU, 59, 1, VW_AMARILLO);
    textoCentrado("OK largo: reintentar", 83, 1, VW_BLANCO);
    return;
  }

  char linea[24];

  textoCentrado(modeloMPU, 30, 1, VW_BLANCO);

  snprintf(linea, sizeof(linea), "Fuerza %.2f g", movimientoActual.magnitudAceleracionG);
  textoCentrado(linea, 47, 1, VW_VERDE);

  snprintf(linea, sizeof(linea), "Cambio %.2f g", movimientoActual.variacionAceleracionG);
  textoCentrado(linea, 62, 1, VW_BLANCO);

  snprintf(linea, sizeof(linea), "Giro %.2f rad/s", movimientoActual.magnitudGiroRadS);
  textoCentrado(linea, 77, 1, VW_BLANCO);

  snprintf(linea, sizeof(linea), "I2C 0x%02X", direccionMPUActiva);
  textoCentrado(linea, 94, 1, VW_GRIS);

  textoCentrado("Umbrales: experimental", 106, 1, VW_AMARILLO);
}

static inline void dibujarSignosVitales() {
  tft.fillScreen(VW_NEGRO);
  dibujarBarraSuperior();
  textoCentrado("SIGNOS VITALES", 15, 1, VW_CIAN);

  if (!max30102Disponible) {
    textoCentrado("MAX30102", 41, 2, VW_ROJO);
    textoCentrado("NO DISPONIBLE", 67, 1, VW_ROJO);
    textoCentrado(detalleErrorMAX30102, 82, 1, VW_AMARILLO);
    return;
  }

  char linea[24];

  switch (estadoMedicionPPG) {
    case EstadoMedicionPPG::SIN_CONTACTO:
      textoCentrado("COLOQUE", 37, 2, VW_AMARILLO);
      textoCentrado("EL DEDO", 59, 2, VW_AMARILLO);
      textoCentrado("Mantenga apoyo suave", 87, 1, VW_BLANCO);
      if (ultimoResultadoVital.timestampMs != 0) {
        snprintf(
          linea,
          sizeof(linea),
          "Ultimo %d bpm %d%%",
          ultimoResultadoVital.bpmValido ? ultimoResultadoVital.bpm : 0,
          ultimoResultadoVital.spo2Valido ? ultimoResultadoVital.spo2 : 0
        );
        textoCentrado(linea, 101, 1, VW_GRIS);
      }
      break;

    case EstadoMedicionPPG::CALIBRANDO:
      textoCentrado("CALIBRANDO", 40, 2, VW_AMARILLO);
      snprintf(linea, sizeof(linea), "IR %lu", (unsigned long)irSuavizado);
      textoCentrado(linea, 70, 1, VW_CIAN);
      textoCentrado("No mueva el dedo", 90, 1, VW_BLANCO);
      break;

    case EstadoMedicionPPG::MIDIENDO: {
      textoCentrado("MIDIENDO", 34, 2, VW_VERDE);

      uint32_t transcurrido = inicioMedicion == 0 ? 0 : millis() - inicioMedicion;
      uint32_t restante = transcurrido >= PPGConfig::TIEMPO_MEDICION_GUIADA_MS
        ? 0
        : PPGConfig::TIEMPO_MEDICION_GUIADA_MS - transcurrido;

      snprintf(linea, sizeof(linea), "%lus restantes", (unsigned long)((restante + 999) / 1000));
      textoCentrado(linea, 59, 1, VW_BLANCO);

      snprintf(linea, sizeof(linea), "BPM %s", bpmInstantaneo > 0 ? "detectado" : "--");
      textoCentrado(linea, 75, 1, bpmInstantaneo > 0 ? VW_VERDE : VW_GRIS);

      snprintf(linea, sizeof(linea), "PPG %.0f", amplitudPPGActual);
      textoCentrado(linea, 91, 1, VW_CIAN);
      break;
    }

    case EstadoMedicionPPG::RESULTADO:
    case EstadoMedicionPPG::SENAL_INSUFICIENTE: {
      char bpmTxt[8];
      char spoTxt[8];
      if (ultimoResultadoVital.bpmValido) snprintf(bpmTxt, sizeof(bpmTxt), "%d", ultimoResultadoVital.bpm);
      else snprintf(bpmTxt, sizeof(bpmTxt), "--");
      if (ultimoResultadoVital.spo2Valido) snprintf(spoTxt, sizeof(spoTxt), "%d%%", ultimoResultadoVital.spo2);
      else snprintf(spoTxt, sizeof(spoTxt), "--%%");

      tft.setTextColor(VW_GRIS, VW_NEGRO);
      tft.setTextSize(1);
      tft.setCursor(12, 36);
      tft.print(F("PULSO"));
      tft.setCursor(78, 36);
      tft.print(F("SpO2"));

      textoCentradoEnZona(bpmTxt, 3, 60, 51, 2, VW_VERDE, VW_NEGRO);
      textoCentradoEnZona(spoTxt, 66, 59, 51, 2, VW_CIAN, VW_NEGRO);

      tft.drawFastHLine(8, 76, 112, VW_GRIS_OSCURO);
      snprintf(linea, sizeof(linea), "Calidad %s", nombreCalidadPPG(ultimoResultadoVital.calidad));
      textoCentrado(
        linea,
        84,
        1,
        ultimoResultadoVital.calidad == CalidadPPG::BUENA ? VW_VERDE : VW_AMARILLO
      );

      textoCentrado(
        ultimoResultadoVital.aproximado ? "LECTURA EXPERIMENTAL" : "LECTURA ESTABLE",
        99,
        1,
        ultimoResultadoVital.aproximado ? VW_AMARILLO : VW_VERDE
      );
      break;
    }

    case EstadoMedicionPPG::SENSOR_NO_DISPONIBLE:
      textoCentrado("SENSOR", 45, 2, VW_ROJO);
      textoCentrado("NO DISPONIBLE", 70, 1, VW_ROJO);
      break;
  }
}

static inline void dibujarAlertaImpacto() {
  tft.fillScreen(VW_ROJO);
  tft.drawRect(3, 3, 122, 122, VW_BLANCO);
  tft.drawRect(6, 6, 116, 116, VW_AMARILLO);

  textoCentrado("AVISO", 13, 2, VW_BLANCO, VW_ROJO);
  textoCentrado("IMPACTO", 39, 2, VW_BLANCO, VW_ROJO);
  textoCentrado("DETECTADO", 64, 1, VW_BLANCO, VW_ROJO);
  textoCentrado("Revise el estado", 80, 1, VW_AMARILLO, VW_ROJO);

  char linea[24];
  snprintf(linea, sizeof(linea), "Pico %.2f g", picoImpactoG);
  textoCentrado(linea, 95, 1, VW_BLANCO, VW_ROJO);
  textoCentrado("OK: cerrar aviso", 111, 1, VW_BLANCO, VW_ROJO);
}

static inline void dibujarFooterNormal() {
  if (modoActual == ModoSistema::SPLASH ||
      modoActual == ModoSistema::ALERTA_IMPACTO) {
    return;
  }

  tft.fillRect(0, InterfazConfig::Y_FOOTER, tft.width(), InterfazConfig::ALTO_FOOTER, VW_GRIS_OSCURO);

  if (modoActual == ModoSistema::MENU) {
    textoCentrado("<  OK elegir  >", 119, 1, VW_BLANCO, VW_GRIS_OSCURO);
  } else {
    textoCentrado("OK volver | OK+ test", 119, 1, VW_BLANCO, VW_GRIS_OSCURO);
  }
}

static inline void marcarBotonPresionado(EventoBoton evento) {
  if (evento == EventoBoton::NINGUNO) return;

  snprintf(textoBotonReciente, sizeof(textoBotonReciente), "BTN %s", nombreEventoBoton(evento));
  hastaIndicadorBoton = millis() + VitalWatchConfig::DURACION_INDICADOR_BOTON_MS;

  if (modoActual == ModoSistema::SPLASH ||
      modoActual == ModoSistema::ALERTA_IMPACTO) {
    return;
  }

  tft.fillRect(0, InterfazConfig::Y_FOOTER, tft.width(), InterfazConfig::ALTO_FOOTER, VW_AZUL_OSCURO);
  textoCentrado(textoBotonReciente, 119, 1, VW_CIAN, VW_AZUL_OSCURO);
}

static inline void renderizarVistaActual() {
  if (!pantallaSucia) return;
  pantallaSucia = false;

  switch (modoActual) {
    case ModoSistema::SPLASH:
      dibujarSplash();
      break;
    case ModoSistema::MENU:
      dibujarMenu();
      dibujarFooterNormal();
      break;
    case ModoSistema::SIGNOS_VITALES:
      dibujarSignosVitales();
      dibujarFooterNormal();
      break;
    case ModoSistema::DIAGNOSTICO_MOVIMIENTO:
      dibujarDiagnosticoMovimiento();
      dibujarFooterNormal();
      break;
    case ModoSistema::ESTADO_SISTEMA:
      dibujarEstadoSistema();
      dibujarFooterNormal();
      break;
    case ModoSistema::ALERTA_IMPACTO:
      dibujarAlertaImpacto();
      break;
  }
}

static inline void actualizarInterfazPeriodica() {
  const uint32_t ahora = millis();

  // La barra se actualiza aparte para no redibujar todo el menu cada segundo.
  if (modoActual != ModoSistema::SPLASH &&
      modoActual != ModoSistema::ALERTA_IMPACTO &&
      ahora - ultimoRefrescoBarra >= VitalWatchConfig::INTERVALO_BARRA_ESTADO_MS) {
    ultimoRefrescoBarra = ahora;
    dibujarBarraSuperior();
  }

  // Cuando desaparece el aviso pequeno del boton se reconstruye solo el footer.
  if (hastaIndicadorBoton != 0 && (int32_t)(ahora - hastaIndicadorBoton) >= 0) {
    hastaIndicadorBoton = 0;
    textoBotonReciente[0] = '\0';
    dibujarFooterNormal();
  }
}

#endif
