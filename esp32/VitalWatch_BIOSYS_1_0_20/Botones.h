#ifndef VITALWATCH_BOTONES_H
#define VITALWATCH_BOTONES_H

#include <Arduino.h>

// ============================================================================
// [BIOSYS-J1] BOTONES, ANTIRREBOTE Y SOS FISICO.
// BOTONES FISICOS - VITALWATCH
// Cableado vigente del proyecto usando INPUT_PULLUP:
//
// GPIO25 ---- BOTON IZQUIERDA ---- GND
// GPIO26 ---- BOTON OK ----------- GND
// GPIO27 ---- BOTON DERECHA ------ GND
// GPIO14 ---- BOTON SOS ---------- GND
//
// Con INPUT_PULLUP no se conecta 3V3 al pulsador. En reposo el pin esta HIGH;
// al pulsar queda conectado a GND y se lee LOW.
// ============================================================================
namespace BotonesConfig {
  static constexpr uint8_t PIN_IZQUIERDA = 25;
  static constexpr uint8_t PIN_OK        = 26;
  static constexpr uint8_t PIN_DERECHA   = 27;
  static constexpr uint8_t PIN_SOS       = 14;

  static constexpr uint32_t REBOTE_MS = 35UL;
  static constexpr uint32_t PULSACION_LARGA_OK_MS = 1200UL;
  // Un toque firme de 300 ms resulta accesible sin ser tan sensible a roces.
  static constexpr uint32_t PULSACION_SOS_MINIMA_MS = 300UL;
  // Evita duplicar avisos por rebote, manipulacion o varias pulsaciones seguidas.
  static constexpr uint32_t BLOQUEO_SOS_MS = 5000UL;
}

enum class EventoBoton : uint8_t {
  NINGUNO = 0,
  IZQUIERDA,
  OK,
  DERECHA,
  OK_LARGO,
  SOS
};

struct EstadoBoton {
  uint8_t pin;
  bool lecturaAnterior;
  bool estadoEstable;
  uint32_t instanteCambio;
  uint32_t inicioPulsacion;
};

static EstadoBoton botonIzquierda = {
  BotonesConfig::PIN_IZQUIERDA, HIGH, HIGH, 0, 0
};
static EstadoBoton botonOK = {
  BotonesConfig::PIN_OK, HIGH, HIGH, 0, 0
};
static EstadoBoton botonDerecha = {
  BotonesConfig::PIN_DERECHA, HIGH, HIGH, 0, 0
};
static EstadoBoton botonSOS = {
  BotonesConfig::PIN_SOS, HIGH, HIGH, 0, 0
};

// Para tres botones y una interfaz humana basta una cola de un evento pendiente.
// Si en el futuro se agregan acciones simultaneas o interrupciones, conviene
// reemplazar esto por una cola circular.
static EventoBoton eventoBotonPendiente = EventoBoton::NINGUNO;
static uint32_t ultimaEmisionSos = 0;

static inline void registrarEventoBoton(EventoBoton evento) {
  // SOS tiene prioridad sobre una accion de navegacion pendiente.
  if (evento == EventoBoton::SOS || eventoBotonPendiente == EventoBoton::NINGUNO) {
    eventoBotonPendiente = evento;
  }
}

static inline void prepararEstadoBoton(EstadoBoton &boton) {
  pinMode(boton.pin, INPUT_PULLUP);
  const bool lectura = digitalRead(boton.pin);
  boton.lecturaAnterior = lectura;
  boton.estadoEstable = lectura;
  boton.instanteCambio = millis();
  boton.inicioPulsacion = 0;
}

static inline void inicializarBotones() {
  prepararEstadoBoton(botonIzquierda);
  prepararEstadoBoton(botonOK);
  prepararEstadoBoton(botonDerecha);
  prepararEstadoBoton(botonSOS);
  eventoBotonPendiente = EventoBoton::NINGUNO;

  Serial.println(F("[INFO][BTN] GPIO25=< GPIO26=OK GPIO27=> GPIO14=SOS, INPUT_PULLUP"));
}

static inline void actualizarUnBoton(
  EstadoBoton &boton,
  EventoBoton eventoCorto,
  EventoBoton eventoLargo = EventoBoton::NINGUNO
) {
  const uint32_t ahora = millis();
  const bool lectura = digitalRead(boton.pin);

  // Cada cambio electrico reinicia el temporizador de antirrebote.
  if (lectura != boton.lecturaAnterior) {
    boton.lecturaAnterior = lectura;
    boton.instanteCambio = ahora;
  }

  if (ahora - boton.instanteCambio < BotonesConfig::REBOTE_MS) return;
  if (lectura == boton.estadoEstable) return;

  boton.estadoEstable = lectura;

  // Con INPUT_PULLUP, LOW = pulsado.
  if (boton.estadoEstable == LOW) {
    boton.inicioPulsacion = ahora;
    return;
  }

  // La accion se confirma al soltar. Esto evita disparar una accion corta y,
  // posteriormente, otra larga para la misma pulsacion.
  const uint32_t duracion = ahora - boton.inicioPulsacion;

  if (eventoLargo != EventoBoton::NINGUNO &&
      duracion >= BotonesConfig::PULSACION_LARGA_OK_MS) {
    registrarEventoBoton(eventoLargo);
  } else {
    registrarEventoBoton(eventoCorto);
  }
}

static inline void actualizarBotonSOS() {
  const uint32_t ahora = millis();
  const bool lectura = digitalRead(botonSOS.pin);

  if (lectura != botonSOS.lecturaAnterior) {
    botonSOS.lecturaAnterior = lectura;
    botonSOS.instanteCambio = ahora;
  }

  if (ahora - botonSOS.instanteCambio < BotonesConfig::REBOTE_MS) return;
  if (lectura == botonSOS.estadoEstable) return;

  botonSOS.estadoEstable = lectura;
  if (botonSOS.estadoEstable == LOW) {
    botonSOS.inicioPulsacion = ahora;
    return;
  }

  // Si la placa arranco con el pulsador ya apretado, no convertir esa
  // condicion inicial en un SOS al soltarlo.
  if (botonSOS.inicioPulsacion == 0) return;
  const uint32_t duracion = ahora - botonSOS.inicioPulsacion;
  botonSOS.inicioPulsacion = 0;
  if (duracion < BotonesConfig::PULSACION_SOS_MINIMA_MS) return;
  if (ultimaEmisionSos != 0 && ahora - ultimaEmisionSos < BotonesConfig::BLOQUEO_SOS_MS) {
    Serial.println(F("[WARN][BTN] SOS ignorado durante bloqueo antirepeticion"));
    return;
  }

  ultimaEmisionSos = ahora;
  registrarEventoBoton(EventoBoton::SOS);
}

static inline void actualizarBotones() {
  actualizarUnBoton(botonIzquierda, EventoBoton::IZQUIERDA);
  actualizarUnBoton(botonOK, EventoBoton::OK, EventoBoton::OK_LARGO);
  actualizarUnBoton(botonDerecha, EventoBoton::DERECHA);
  actualizarBotonSOS();
}

static inline EventoBoton consumirEventoBoton() {
  const EventoBoton evento = eventoBotonPendiente;
  eventoBotonPendiente = EventoBoton::NINGUNO;
  return evento;
}

static inline const char* nombreEventoBoton(EventoBoton evento) {
  switch (evento) {
    case EventoBoton::IZQUIERDA: return "<";
    case EventoBoton::OK:        return "OK";
    case EventoBoton::DERECHA:   return ">";
    case EventoBoton::OK_LARGO:  return "OK+";
    case EventoBoton::SOS:       return "SOS";
    default:                      return "";
  }
}

#endif
