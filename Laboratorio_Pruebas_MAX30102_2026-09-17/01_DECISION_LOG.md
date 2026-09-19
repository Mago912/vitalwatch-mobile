# 01 — Registro de decisiones

> Todas las implementaciones de prueba se identifican como **CODEX REPRODUCTION TESTS**.

## DEC-001

**PROBLEMA:** IRR-001, primera muestra desfasada en el buffer SparkFun.  
**EVIDENCIA:** `check()` incrementa head antes de escribir; getter lee tail.  
**ARCHIVO:** `MAX30105.cpp`.  
**ESTADO ANTES:** inspección confirmada; reproducción independiente ejecutada.  
**CAMBIO PROPUESTO:** convertir `head` en próxima posición de escritura y
mantener ocupación explícita.  
**POR QUÉ:** la primera muestra leída debe ser la primera recibida.  
**RIESGO:** cambiar semántica de getters recientes.  
**CÓMO PROBARLO:** entradas 200/201 deben salir 200/201.  
**RESULTADO:** `INDEPENDENTLY REPRODUCED` por `test_irr001_fifo_order_is_independently_reproduced`. Entradas 200/201 producen 0/200 en el contrato original.  
**DECISIÓN FINAL:** `KEEP`: corregir únicamente en el driver copiado del laboratorio.

## DEC-002

**PROBLEMA:** IRR-002, lleno y vacío se confunden con cuatro posiciones.  
**EVIDENCIA:** `available()` usa sólo diferencia de índices.  
**ARCHIVO:** `MAX30105.h/.cpp`.  
**ESTADO ANTES:** inspección confirmada; reproducción independiente ejecutada.  
**CAMBIO PROPUESTO:** contador de ocupación y contador de overflow software.  
**POR QUÉ:** aprovechar las cuatro posiciones y registrar sobrescrituras.  
**RIESGO:** RAM y compatibilidad del driver.  
**CÓMO PROBARLO:** cuatro inserciones deben producir `available=4`.  
**RESULTADO:** `INDEPENDENTLY REPRODUCED` por `test_irr002_full_fifo_looks_empty_is_independently_reproduced`: cuatro inserciones dejan `head==tail` y `available()==0`.  
**DECISIÓN FINAL:** `KEEP`: ocupación explícita y overflow software en la copia controlada.

## DEC-003

**PROBLEMA:** IRR-003, lectura corta convertida en RAW `262143`.  
**EVIDENCIA:** retorno de `requestFrom()` ignorado y `read=-1` convertido a byte.  
**ARCHIVO:** `MAX30105.cpp/.h`.  
**ESTADO ANTES:** inspección confirmada; reproducción independiente ejecutada.  
**CAMBIO PROPUESTO:** validar longitud antes de decodificar; exponer estado y
contador de lecturas cortas.  
**POR QUÉ:** un error de transporte nunca debe parecer una medición.  
**RIESGO:** descartar una tanda parcial; debe quedar registrado.  
**CÓMO PROBARLO:** lectura de cinco de seis bytes debe ser READ_SHORT y no
crear muestra.  
**RESULTADO:** `INDEPENDENTLY REPRODUCED` por `test_irr003_short_read_becomes_262143_is_independently_reproduced`: `read()==-1` termina como `0x3FFFF`.  
**DECISIÓN FINAL:** `KEEP`: rechazar el registro incompleto y contarlo, sin convertirlo en muestra.

## DEC-004

**PROBLEMA:** IRR-004, timestamp estimado reanclado en cada tanda.  
**EVIDENCIA:** `newestApproxUs=micros()` en cada `update()`.  
**ARCHIVO:** `Sensor_Oxigeno.cpp/.h`.  
**ESTADO ANTES:** inspección confirmada; reproducción independiente ejecutada.  
**CAMBIO PROPUESTO:** reloj estimado continuo a 40.000 us y etiqueta
`ESTIMATED`; conservar tiempo de procesamiento separado.  
**POR QUÉ:** evitar que la planificación del loop cambie artificialmente IBI.  
**RIESGO:** deriva respecto del reloj físico; se documenta incertidumbre.  
**CÓMO PROBARLO:** tandas con jitter deben mantener timestamps monotónicos.  
**RESULTADO:** `INDEPENDENTLY REPRODUCED` por `test_irr004_batch_reanchoring_changes_interval`: el jitter del loop altera artificialmente el intervalo entre tandas.  
**DECISIÓN FINAL:** `KEEP`: reloj estimado continuo, explícitamente rotulado `ESTIMATED`.

## DEC-005

**PROBLEMA:** IRR-005, rollover de `micros()`.  
**EVIDENCIA:** cast a 64 bits posterior a la lectura de 32 bits.  
**ARCHIVO:** nuevo `MonotonicMicros.*`.  
**ESTADO ANTES:** inspección confirmada; reproducción independiente ejecutada.  
**CAMBIO PROPUESTO:** detectar retroceso y sumar una época de `2^32`.  
**POR QUÉ:** obtener tiempo monotónico durante sesiones largas.  
**RIESGO:** acceso concurrente; se usará desde el loop de sensores.  
**CÓMO PROBARLO:** cruzar `0xFFFFFFFF→0` sin retroceso.  
**RESULTADO:** `INDEPENDENTLY REPRODUCED` por `test_irr005_cast_after_rollover_goes_backwards`: el cast posterior no recupera la época perdida.  
**DECISIÓN FINAL:** `KEEP`: extender `micros()` de 32 a 64 bits detectando rollover.

## DEC-006

**PROBLEMA:** IRR-006, pérdidas agrupadas o invisibles.  
**EVIDENCIA:** sólo `suspectedSoftwareDrops`; overflow HW no invalida timing.  
**ARCHIVO:** driver, `Sensor_Oxigeno`, logger.  
**ESTADO ANTES:** inspección confirmada; reproducción independiente ejecutada.  
**CAMBIO PROPUESTO:** contadores separados `hardware_overflow`,
`software_overflow`, `short_read`, `sequence_gap`, `logger_drop`.  
**POR QUÉ:** cada pérdida debe ser explicable.  
**RIESGO:** más bytes y tráfico Serial.  
**CÓMO PROBARLO:** inyectar cada pérdida y verificar sólo su contador.  
**RESULTADO:** `INDEPENDENTLY REPRODUCED` por `test_irr006_loss_dimensions_are_not_equivalent`: los cinco tipos de pérdida representan causas distintas.  
**DECISIÓN FINAL:** `KEEP`: contadores separados; no sumar dimensiones incompatibles bajo una sola etiqueta.

## Evidencia de ejecución

- Fecha local: 2026-09-17.
- Suite: `tests/test_acquisition_contract.py`.
- Identidad: **CODEX REPRODUCTION TESTS**; no son tests originales de Cowork.
- Resultado global previo a las correcciones: 15 tests ejecutados, 15 `OK`.
- `FINAL_BIOMED_CANDIDATE`: `NOT_AVAILABLE`; no se utilizó ni reconstruyó.
