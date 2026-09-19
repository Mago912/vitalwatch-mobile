#ifndef VITALWATCH_MONOTONIC_MICROS_H
#define VITALWATCH_MONOTONIC_MICROS_H

#include <Arduino.h>

// Extiende el contador micros() de 32 bits sin alterar la fuente de tiempo.
// Debe llamarse desde el loop principal; no se usa desde ISR.
namespace MonotonicMicros {
  uint64_t now();
  void resetForTest(uint32_t rawValue = 0);
}

#endif
