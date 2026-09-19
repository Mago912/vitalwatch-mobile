#ifndef VITALWATCH_BOTONES_H
#define VITALWATCH_BOTONES_H

#include <Arduino.h>

/*
  BOTONES 0.6.0
  - INPUT_PULLUP, sin resistencias externas obligatorias.
  - Debounce temporal, sin delay().
  - La accion corta/larga se confirma al SOLTAR.
  - El feedback fisico PRESSED se expone inmediatamente despues del debounce.
  - Si un boton ya esta presionado durante boot, esa pulsacion se ignora hasta
    que el pin haya vuelto a HIGH estable; evita calcular duracion desde t=0.
*/

enum class EventoBoton : uint8_t { NINGUNO=0, IZQUIERDA, OK, DERECHA, OK_LARGO };
enum class EventoFisicoBoton : uint8_t { NINGUNO=0, IZQUIERDA_PRESIONADA, OK_PRESIONADO, DERECHA_PRESIONADA };

namespace ButtonService {
  void begin();
  void update();
  EventoBoton consumeAction();
  EventoFisicoBoton consumePhysicalPress();
  const char* actionName(EventoBoton event);
  const char* physicalName(EventoFisicoBoton event);
  uint32_t droppedEvents();
}

#endif
