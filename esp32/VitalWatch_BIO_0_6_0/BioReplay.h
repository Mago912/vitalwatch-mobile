#ifndef VITALWATCH_BIO_REPLAY_H
#define VITALWATCH_BIO_REPLAY_H

#include <Arduino.h>

/*
  Replay por Serial para datasets guardados.
  BIO_REPLAY_MODE=1 espera:
    sample_index,sample_time_us,red_raw,ir_raw,timing_valid
  RESET reinicia el mismo pipeline matematico que usa el hardware.
*/
namespace BioReplay {
  void begin();
  void update();
  uint32_t acceptedRows();
  uint32_t rejectedRows();
}

#endif
