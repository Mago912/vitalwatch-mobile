#include "Botones.h"
#include "Configuracion.h"

namespace {
struct ButtonState {
  uint8_t pin;
  bool rawLast;
  bool stable;
  uint32_t changedAtMs;
  uint32_t pressedAtMs;
  bool armed; // false mientras un boton arrancó presionado.
};

ButtonState left  = {VitalWatchConfig::BTN_IZQUIERDA, HIGH, HIGH, 0, 0, true};
ButtonState ok    = {VitalWatchConfig::BTN_OK, HIGH, HIGH, 0, 0, true};
ButtonState right = {VitalWatchConfig::BTN_DERECHA, HIGH, HIGH, 0, 0, true};

EventoBoton pendingAction = EventoBoton::NINGUNO;
EventoFisicoBoton pendingPhysical = EventoFisicoBoton::NINGUNO;
uint32_t dropped = 0;

void pushAction(EventoBoton e) {
  if (pendingAction == EventoBoton::NINGUNO) pendingAction = e;
  else ++dropped;
}
void pushPhysical(EventoFisicoBoton e) {
  if (pendingPhysical == EventoFisicoBoton::NINGUNO) pendingPhysical = e;
}

void prepare(ButtonState &b) {
  pinMode(b.pin, INPUT_PULLUP);
  const bool v = digitalRead(b.pin);
  b.rawLast = v;
  b.stable = v;
  b.changedAtMs = millis();
  b.pressedAtMs = 0;
  // Si arranca LOW, no generaremos accion al soltar esa pulsacion preexistente.
  b.armed = (v == HIGH);
}

void updateOne(ButtonState &b, EventoBoton shortAction, EventoFisicoBoton physical, EventoBoton longAction=EventoBoton::NINGUNO) {
  const uint32_t now = millis();
  const bool raw = digitalRead(b.pin);

  if (raw != b.rawLast) {
    b.rawLast = raw;
    b.changedAtMs = now;
  }
  if ((uint32_t)(now - b.changedAtMs) < VitalWatchConfig::BTN_DEBOUNCE_MS) return;
  if (raw == b.stable) return;

  b.stable = raw;
  if (raw == LOW) {
    if (!b.armed) return;
    b.pressedAtMs = now;
    pushPhysical(physical);
    return;
  }

  // HIGH estable. Si era una pulsacion de boot, solo rearmamos y no actuamos.
  if (!b.armed) {
    b.armed = true;
    b.pressedAtMs = 0;
    return;
  }
  if (b.pressedAtMs == 0) return;

  const uint32_t heldMs = now - b.pressedAtMs;
  b.pressedAtMs = 0;
  if (longAction != EventoBoton::NINGUNO && heldMs >= VitalWatchConfig::BTN_LONG_OK_MS)
    pushAction(longAction);
  else
    pushAction(shortAction);
}
}

namespace ButtonService {
void begin() {
  prepare(left); prepare(ok); prepare(right);
  pendingAction = EventoBoton::NINGUNO;
  pendingPhysical = EventoFisicoBoton::NINGUNO;
  dropped = 0;
  Serial.println(F("[INFO][BTN] GPIO25=< GPIO26=OK GPIO27=> INPUT_PULLUP"));
}

void update() {
  updateOne(left, EventoBoton::IZQUIERDA, EventoFisicoBoton::IZQUIERDA_PRESIONADA);
  updateOne(ok, EventoBoton::OK, EventoFisicoBoton::OK_PRESIONADO, EventoBoton::OK_LARGO);
  updateOne(right, EventoBoton::DERECHA, EventoFisicoBoton::DERECHA_PRESIONADA);
}

EventoBoton consumeAction() { EventoBoton e=pendingAction; pendingAction=EventoBoton::NINGUNO; return e; }
EventoFisicoBoton consumePhysicalPress() { auto e=pendingPhysical; pendingPhysical=EventoFisicoBoton::NINGUNO; return e; }
uint32_t droppedEvents() { return dropped; }

const char* actionName(EventoBoton e) {
  switch(e){case EventoBoton::IZQUIERDA:return "<"; case EventoBoton::OK:return "OK"; case EventoBoton::DERECHA:return ">"; case EventoBoton::OK_LARGO:return "OK+"; default:return "";}
}
const char* physicalName(EventoFisicoBoton e) {
  switch(e){case EventoFisicoBoton::IZQUIERDA_PRESIONADA:return "<"; case EventoFisicoBoton::OK_PRESIONADO:return "OK"; case EventoFisicoBoton::DERECHA_PRESIONADA:return ">"; default:return "";}
}
}
