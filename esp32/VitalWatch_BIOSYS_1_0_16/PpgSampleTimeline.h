#ifndef VITALWATCH_PPG_SAMPLE_TIMELINE_H
#define VITALWATCH_PPG_SAMPLE_TIMELINE_H

#include <stdint.h>

namespace PpgSampleTimeline {

// Reconstruye el tiempo fisico de una muestra adquirida por FIFO.
// El reloj de servicio solo ancla el primer lote. Desde ese punto, la secuencia
// es la fuente de verdad para impedir que el jitter del loop altere los IBI.
constexpr uint64_t estimate(
  uint64_t lastSampleUs,
  uint32_t lastSequence,
  uint32_t sequence,
  uint64_t serviceTimeUs,
  uint8_t samplesAfterCurrent,
  uint32_t samplePeriodUs
) {
  return lastSampleUs == 0
    ? serviceTimeUs - (uint64_t)samplesAfterCurrent * samplePeriodUs
    : lastSampleUs + (uint64_t)(sequence - lastSequence) * samplePeriodUs;
}

}

#endif
