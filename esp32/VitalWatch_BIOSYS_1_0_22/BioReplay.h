#ifndef VITALWATCH_BIO_REPLAY_H
#define VITALWATCH_BIO_REPLAY_H

#include <Arduino.h>

/*
  Replay por Serial del pipeline PPG real.

  BIO_REPLAY_MODE=1 acepta:
    sequence,sample_time_us,red,ir,timing_valid,
    acceleration_delta_g,gyro_magnitude_rad_s,saturated

  RESET limpia el pipeline y los contadores. END publica un resumen estable
  para las pruebas automatizadas. No existe un algoritmo PPG alternativo.
*/
namespace BioReplay {
  void begin();
  void update();
  uint32_t acceptedRows();
  uint32_t rejectedRows();
}

#endif
