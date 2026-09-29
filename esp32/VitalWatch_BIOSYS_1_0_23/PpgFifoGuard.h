#ifndef VITALWATCH_PPG_FIFO_GUARD_H
#define VITALWATCH_PPG_FIFO_GUARD_H

#include <stdint.h>

namespace PpgFifoGuard {

// Los punteros FIFO del MAX30102 tienen cinco bits. Su diferencia valida se
// encuentra entre 0 y 31; valores mayores proceden de una lectura I2C corrupta
// o de un underflow dentro de la biblioteca MAX3010x.
constexpr uint16_t MAX_PLAUSIBLE_CHECK_COUNT = 31;

constexpr bool isPlausibleCheckCount(uint16_t found) {
  return found <= MAX_PLAUSIBLE_CHECK_COUNT;
}

constexpr uint16_t confirmedSoftwareDrops(uint16_t found, uint8_t available) {
  return isPlausibleCheckCount(found) && found > available
    ? static_cast<uint16_t>(found - available)
    : 0;
}

}

#endif
