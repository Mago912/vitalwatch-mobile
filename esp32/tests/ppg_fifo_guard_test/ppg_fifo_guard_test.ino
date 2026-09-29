#include "../../VitalWatch_BIOSYS_1_0_21/PpgFifoGuard.h"

// Un FIFO de 32 posiciones solo puede informar una diferencia de 0 a 31.
static_assert(
  PpgFifoGuard::isPlausibleCheckCount(0),
  "Cero muestras nuevas es un resultado valido"
);
static_assert(
  PpgFifoGuard::isPlausibleCheckCount(31),
  "Treinta y una muestras es el maximo fisicamente representable"
);
static_assert(
  !PpgFifoGuard::isPlausibleCheckCount(32),
  "Una diferencia de 32 ya no cabe en los punteros FIFO de cinco bits"
);

// Valores reproducidos físicamente el 2026-09-28. Nunca deben convertirse en
// muestras perdidas ni adelantar el reloj fisiologico.
static_assert(
  !PpgFifoGuard::isPlausibleCheckCount(125),
  "El conteo corrupto 125 debe rechazarse"
);
static_assert(
  !PpgFifoGuard::isPlausibleCheckCount(65440),
  "El underflow observado debe rechazarse"
);
static_assert(
  !PpgFifoGuard::isPlausibleCheckCount(65535),
  "UINT16_MAX debe rechazarse"
);
static_assert(
  PpgFifoGuard::confirmedSoftwareDrops(31, 3) == 28,
  "Un lote valido conserva la perdida comprobable"
);
static_assert(
  PpgFifoGuard::confirmedSoftwareDrops(125, 3) == 0,
  "Una lectura corrupta no puede fabricar perdidas"
);
static_assert(
  PpgFifoGuard::confirmedSoftwareDrops(65440, 3) == 0,
  "El underflow no puede adelantar la secuencia"
);

void setup() {}
void loop() {}
