# 02 — Cambios explicados

## Alcance

Esta carpeta es un laboratorio experimental derivado del baseline exacto
BIOSYS 1.0.8. No reemplaza la versión estable y no cambia sus números
`BIOSYS 1.0.8 / SYS 0.9.8 / BIO 0.6.3`.

`FINAL_BIOMED_CANDIDATE` está marcado `NOT_AVAILABLE`. No se copió, recreó ni
se afirmó equivalencia con ese material. Las pruebas de esta entrega son
**CODEX REPRODUCTION TESTS**.

## Qué se cambió

### 1. Buffer privado del MAX30102

En la copia `SparkFun_MAX3010x_Lab`:

- `head` ahora señala la próxima posición de escritura;
- `tail` señala la próxima muestra de lectura;
- `count` distingue inequívocamente lleno de vacío;
- si las cuatro posiciones están ocupadas, se descarta la muestra más antigua
  y se incrementa `softwareOverflowCount`;
- `getRed/getIR/getGreen` localizan correctamente la muestra más reciente;
- `nextSample()` reduce la ocupación.

Esto corrige IRR-001 e IRR-002 sin tocar la biblioteca global instalada.

### 2. Lecturas I²C cortas

Antes de decodificar una tanda se valida cuántos bytes devolvió
`Wire.requestFrom()`. Una respuesta incompleta:

- no genera una muestra RAW falsa;
- vacía los bytes parciales recibidos;
- establece `READ_SHORT`;
- incrementa un contador independiente.

Así el valor de error `-1` ya no puede transformarse en `262143`. Esta es la
corrección propia de IRR-003.

### 3. Reloj estimado continuo

`MonotonicMicros` extiende `micros()` a 64 bits y detecta el rollover de 32
bits. La primera tanda se ancla al instante de servicio; las siguientes avanzan
por el período nominal de 40.000 µs y por el número de secuencia. El timestamp
se etiqueta siempre `ESTIMATED_PERIODIC`: el MAX30102 no proporciona un reloj
nativo por muestra.

También se guarda `serviceTimeUs` por separado. Esto corrige IRR-004 e IRR-005
sin presentar un tiempo estimado como si hubiera sido adquirido por el sensor.

### 4. Pérdidas separadas

Se conservan dimensiones independientes:

- `hardwareOverflowTotal`: pérdida reportada por el FIFO físico;
- `softwareOverflowTotal`: muestra completa desplazada del buffer del driver;
- `shortReadTotal`: transacción I²C incompleta;
- `sequenceGapTotal`: índices omitidos por las causas anteriores;
- `logger_drop_total`: registro que no entró en la cola de salida.

No se suman bajo una etiqueta ambigua. Los huecos se reflejan en `sample_index`
y desactivan temporalmente la validez de timing que ya usaba el algoritmo.

### 5. Logger de laboratorio

El logger usa cola fija, envío fragmentado y tres modos:

- `OFF`: valor inicial; no se capturan muestras;
- `RAW`: RAW PPG, integridad y fotografía del último IMU ya adquirido;
- `FULL`: añade variables derivadas y diagnósticos existentes.

No se realiza una segunda lectura del MPU. Los comandos y registros se detallan
en `BIO_CAPTURE_README.md`.

### 6. Capturador de PC

`tools/capture_biomed.py` conserva cada línea recibida en `serial_raw.log` y
separa los registros estructurados en CSV/JSON. Una línea estructurada corrupta
no se convierte en muestra: queda contada y registrada como error de parser.

### 7. Ajustes posteriores a la prueba física

- cada registro `@VW_*` se transmite en una sola escritura UART para impedir
  que logs concurrentes lo partan;
- `WR_PTR`, `OVF_COUNTER` y `RD_PTR` se fotografían en una sola transacción;
- punteros iguales ya no generan por sí solos 32 muestras fantasma;
- el FIFO se descarta una vez al comenzar el servicio, aislando conversiones
  acumuladas durante el arranque;
- el byte OVF crudo siempre se registra, pero sólo suma pérdidas si backlog o
  tiempo de servicio corroboran que el FIFO físico pudo llenarse.

Estas decisiones y la evidencia real están en
`06_VALIDACION_FISICA_2026-09-18.md`.

## Qué no se cambió

No se retocaron umbrales, filtros, detección de picos, cálculo de BPM, cálculo
de SpO₂, contacto, calidad, caída, SOS, botones, TFT, app, Wi-Fi,
Supabase, medicación ni mensajería. Las advertencias heredadas dentro de
`heartRate.cpp` y `spo2_algorithm.h` se dejaron intactas por esa misma razón.

La autoganancia conserva límites, pasos y algoritmo; sólo se adelantó su
ejecución antes de confirmar contacto para evitar el bloqueo observado cuando
la señal real superaba el umbral de inicio pero no el de contacto.

## Riesgo y límite

La compilación ocupa 90 % de la partición de programa. Es válida, pero deja
poco margen de flash. Este laboratorio es para adquisición y diagnóstico, no
para uso clínico ni para reemplazar el baseline estable.
