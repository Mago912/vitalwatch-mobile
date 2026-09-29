#include "../../VitalWatch_BIOSYS_1_0_15/PpgSampleTimeline.h"

// Primer lote: tres muestras pendientes al atender el sensor en t=1.000.000 us.
static_assert(
  PpgSampleTimeline::estimate(0, 0, 10, 1000000ULL, 2, 40000UL) == 920000ULL,
  "La primera muestra debe retroceder segun su posicion dentro del lote"
);

// El siguiente servicio llega 45 ms despues, pero la muestra biologica debe
// conservar el periodo nominal de 40 ms y no heredar jitter del loop.
static_assert(
  PpgSampleTimeline::estimate(920000ULL, 10, 11, 1045000ULL, 0, 40000UL) == 960000ULL,
  "El tiempo PPG no debe reanclarse al tiempo de servicio"
);

// Un hueco comprobado en la secuencia conserva el tiempo fisico perdido.
static_assert(
  PpgSampleTimeline::estimate(960000ULL, 11, 14, 1100000ULL, 0, 40000UL) == 1080000ULL,
  "Los huecos de secuencia deben avanzar un periodo por muestra perdida"
);

void setup() {}
void loop() {}
