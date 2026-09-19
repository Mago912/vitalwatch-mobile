#include "MonotonicMicros.h"

namespace {
uint32_t previousRaw = 0;
uint64_t epoch = 0;
bool initialized = false;
}

namespace MonotonicMicros {
uint64_t now() {
  const uint32_t raw = micros();
  if (!initialized) {
    previousRaw = raw;
    initialized = true;
    return raw;
  }
  if (raw < previousRaw) epoch += (1ULL << 32);
  previousRaw = raw;
  return epoch | (uint64_t)raw;
}

void resetForTest(uint32_t rawValue) {
  previousRaw = rawValue;
  epoch = 0;
  initialized = rawValue != 0;
}
}
