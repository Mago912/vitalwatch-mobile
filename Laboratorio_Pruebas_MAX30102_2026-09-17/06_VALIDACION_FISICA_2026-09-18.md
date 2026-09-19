# 06 — Validación física del MAX30102 — 2026-09-18

## Alcance y criterio

Esta validación se realizó con el ESP32 real conectado en `COM3`, un MAX30102
y el firmware experimental derivado de BIOSYS 1.0.8. Confirma integridad de
adquisición, transporte y registro. **No valida exactitud clínica**: no se
registraron ECG, pulsioxímetro de referencia ni valores manuales simultáneos.

El firmware instalado informa `BIOSYS 1.0.8 / SYS 0.9.8 / BIO 0.6.3` y usa:

- MAX30102 a 100 Hz con promedio FIFO de 4;
- frecuencia efectiva esperada de 25 Hz;
- período estimado de 40.000 microsegundos;
- I²C a 100 kHz;
- logger `FULL` por UART a 460800 baudios.

## Correcciones guiadas por evidencia física

Las primeras capturas revelaron problemas que las pruebas host no podían
mostrar:

1. Un mensaje Wi-Fi podía intercalarse dentro de una línea `@VW_RAW` porque el
   logger la enviaba en fragmentos. Se cambió a una única llamada
   `Serial.write()` por registro estructurado.
2. Los punteros `WR_PTR`, `OVF_COUNTER` y `RD_PTR` se leían por separado. Se
   cambiaron a una fotografía I²C de tres bytes para no combinar estados de
   instantes diferentes.
3. Se eliminó la inferencia «punteros iguales + OVF distinto de cero = FIFO
   lleno», porque producía muestras fantasma en el módulo real.
4. Se añadió una limpieza única del FIFO al comenzar el bucle cooperativo. El
   sensor ya convierte mientras terminan Wi-Fi y los demás servicios; las
   muestras acumuladas durante ese arranque no pertenecen a una captura
   controlada.
5. `OVF_COUNTER` se trata como contador saturable que se reinicia al extraer
   una muestra, no como contador circular. Esta semántica proviene de la hoja
   de datos oficial del MAX30102.
6. El módulo físico probado devuelve `OVF_COUNTER=1` aun con una única muestra
   pendiente y servicio regular a 25 Hz. El valor crudo se conserva en
   `hardware_overflow_raw`, pero sólo se convierte en pérdida cuando existe
   corroboración física: FIFO casi lleno o pausa suficiente para llenar sus 32
   posiciones. En esta sesión no existió dicha corroboración.

Referencia técnica: [hoja de datos MAX30102 de Analog Devices](https://www.analog.com/media/en/technical-documentation/data-sheets/max30102.pdf).

## Preflight final sin dedo

Sesión: `RAW/20260918_143152_preflight_safeguard_anon`

| Métrica | Resultado |
|---|---:|
| Duración | 8 s |
| Muestras | 200 |
| Frecuencia efectiva | 25,0 Hz |
| Líneas estructuradas corruptas | 0 |
| Huecos de secuencia | 0 |
| Secuencias duplicadas | 0 |
| Timing válido | 200/200 |
| Overflow hardware corroborado | 0 |
| Overflow de software | 0 |
| Lecturas I²C cortas | 0 |
| Drops del logger | 0 |
| Backlog FIFO máximo | 4 |

Resultado: **PASS de preflight de adquisición**.

## Primera captura real con dedo

Sesión: `RAW/20260918_143304_dedo_reposo_90s_anon`

### Integridad de adquisición

| Métrica | Resultado |
|---|---:|
| Duración de muestras | 89,96 s |
| Muestras | 2250 |
| Frecuencia efectiva | 25,000 Hz |
| Delta temporal | 2249/2249 exactamente 40.000 µs |
| Líneas estructuradas corruptas | 0 |
| Huecos de secuencia | 0 |
| Secuencias duplicadas | 0 |
| Timing válido | 2250/2250 |
| Overflow hardware corroborado | 0 |
| Overflow de software | 0 |
| Lecturas I²C cortas | 0 |
| Drops del logger | 0 |
| Backlog FIFO máximo | 4 |
| IMU válida | 2250/2250 |
| Saturación IMU | 0 |

Los valores ópticos quedaron por debajo del máximo ADC de 18 bits (262143):
rojo 161970–163968 e infrarrojo 182159–185677. No hubo evidencia de saturación
óptica según el umbral del firmware (250000).

Resultado: **PASS de adquisición física y trazabilidad** para IRR-001 a
IRR-005. IRR-006 queda **PASS WITH HARDWARE DISCREPANCY**: las pérdidas
corroboradas son cero, pero el byte OVF crudo anómalo se conserva para futuras
comparaciones de módulos.

### Observación algorítmica, no clínica

- BPM finito en 848/2250 muestras: mediana 83,333; rango 75–150.
- Estado HR `VALID` en 501 muestras y `UNSTABLE` en 347.
- Hubo 1299 muestras con `LOW_PULSATILITY` y 347 con
  `IBI_INCONSISTENT`; no se obtuvo calidad `GOOD`.
- Se aceptaron 106 eventos de pico; los IBI registrados tuvieron mediana de
  720 ms y rango amplio de 400–1480 ms.
- El intervalo 40–50 s no produjo BPM finito, y entre 50–60 s la mediana subió
  a 136 BPM. Esto impide considerar estable o exacto el resultado de pulso.
- SpO₂ experimental finita en 1900/2250 muestras, con mediana 100 y rango
  98–100. Sin referencia externa, esto sólo demuestra salida del algoritmo.
- El estado `TIMEOUT` apareció durante 42 muestras y luego volvió a
  `RESULT_READY`; requiere revisión futura de la máquina de sesión, pero no
  alteró la integridad de la captura.

Conclusión biomédica: **INCONCLUSIVE / REFERENCE NOT AVAILABLE**. Los datos son
útiles para ajustar y comparar algoritmos, no para interpretar salud ni tomar
decisiones médicas.

## Artefactos de evidencia

La sesión principal contiene `serial_raw.log`, `samples.csv`, `events.csv`,
`status.csv`, `reference.csv`, `metadata.json` y `session_summary.json`. El
sujeto está identificado únicamente como `anon`, pero los datos siguen siendo
biométricos y deben tratarse como sensibles.

