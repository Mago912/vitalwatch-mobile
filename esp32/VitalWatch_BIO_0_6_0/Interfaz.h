#ifndef VITALWATCH_INTERFAZ_H
#define VITALWATCH_INTERFAZ_H

#include <Arduino.h>
#include "Configuracion.h"
#include "Botones.h"

/*
  DISPLAY SERVICE 0.6.0
  ---------------------
  La pantalla es consumidora de datos, no propietaria de sensores.

  Estrategia de dibujo:
  - VIEW_CHANGED: se dibuja fondo/titulos una sola vez.
  - DATA_CHANGED: se limpian y redibujan SOLO rectangulos dinamicos.
  - Nunca se usa fillScreen() a 2-5 Hz para actualizar numeros.
*/

struct DatosBarraSuperior {
  bool climaValido;
  int temperaturaC;
  bool bateriaValida;
  int bateriaPorcentaje;
  bool horaValida;
  uint8_t hora;
  uint8_t minuto;
};

namespace DisplayService {
  void begin();
  void update();
  void invalidateView();
  void notifyPhysicalButton(EventoFisicoBoton event);
  void setWeather(int tempC, bool valid=true);
  void setBattery(int percent, bool valid=true);
  void setClock(uint8_t hour, uint8_t minute, bool valid=true);
  void menuPrevious();
  void menuNext();
  ModoSistema selectedMenuMode();
  uint8_t selectedMenuIndex();
}

#endif
