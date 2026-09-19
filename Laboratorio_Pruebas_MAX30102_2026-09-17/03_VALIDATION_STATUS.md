# 03 — Estado maestro de validación

| Hallazgo | Inspección | CODEX reproduction test | Corrección host | Compilación ESP32 | Sensor físico | Efecto biomédico |
|---|---|---|---|---|---|---|
| IRR-001 orden FIFO | CONFIRMED | INDEPENDENTLY REPRODUCED | PASS | PASS | PASS | UNKNOWN |
| IRR-002 capacidad | CONFIRMED | INDEPENDENTLY REPRODUCED | PASS | PASS | PASS | UNKNOWN |
| IRR-003 lectura corta | CONFIRMED | INDEPENDENTLY REPRODUCED | PASS | PASS | PASS | UNKNOWN |
| IRR-004 timestamp | CONFIRMED | INDEPENDENTLY REPRODUCED | PASS | PASS | PASS | UNKNOWN |
| IRR-005 rollover | CONFIRMED | INDEPENDENTLY REPRODUCED | PASS | PASS | PASS | UNKNOWN |
| IRR-006 pérdidas | CONFIRMED | INDEPENDENTLY REPRODUCED | PASS | PASS | PASS WITH HW DISCREPANCY | UNKNOWN |

`CONFIRMED` aquí significa confirmado en el código exacto, no causa clínica de
los saltos de BPM.

La suite previa a la implementación ejecutó 15 pruebas y finalizó `OK`. La
suite final ejecutó 22 y finalizó `OK`, incluidos parser, artefactos y las
salvaguardas derivadas de la prueba física. Son
**CODEX REPRODUCTION TESTS**. No se dispuso de `FINAL_BIOMED_CANDIDATE` ni de
los tests originales de Cowork.

`PASS` físico significa 2250 muestras reales a 25 Hz, sin huecos, duplicados,
lecturas cortas ni drops. El módulo devolvió un valor OVF crudo físicamente
incompatible con overflow real; quedó registrado y aislado mediante
corroboración de backlog/tiempo. Ver `06_VALIDACION_FISICA_2026-09-18.md`.

El efecto biomédico sigue `UNKNOWN`: no hubo referencia externa y la calidad
de HR fue irregular. `PASS` de adquisición no significa exactitud clínica.
