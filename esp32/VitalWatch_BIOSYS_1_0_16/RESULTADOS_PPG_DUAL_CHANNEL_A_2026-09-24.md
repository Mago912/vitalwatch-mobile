# BIOSYS 1.0.16 — resultados PPG dual channel A

Fecha: 2026-09-24

Placa: ESP32 clásico NodeMCU, 38 pines

Sensor: MAX30102

Tipo de evidencia: **CODEX REPRODUCTION TESTS**

Conclusión: **INDEPENDENTLY REPRODUCED**

## Alcance y significado de `VALID`

`VALID` expresa únicamente que la señal superó las barreras técnicas internas del
firmware: contacto, temporización, fusión rojo/IR, SNR, coherencia de intervalos,
ausencia de artefactos detectados y tiempo limpio. No constituye validación
clínica, diagnóstico médico ni comparación contra un instrumento certificado.

No se utilizó ni se reconstruyó `FINAL_BIOMED_CANDIDATE`. Las pruebas descritas
aquí fueron creadas y ejecutadas independientemente por Codex sobre el baseline
entregado.

## Cambio confirmado

El detector anterior encontraba suficientes candidatos y buena SNR, pero elegía
máximos secundarios y omitía pulsos. Esto producía intervalos IBI con MAD y rango
excesivos, por lo que el firmware correctamente se negaba a publicar FC válida.

La revisión final utiliza:

- FIR corto de 7 muestras y FIR largo de 20 muestras;
- supresión no máxima de 320.000 µs, compatible con el límite técnico de 190 lpm;
- umbral de candidatos `noise + 0,05 × (signal - noise)`;
- coincidencia obligatoria rojo/IR dentro de 120.000 µs;
- memoria fija, sin asignación dinámica;
- las barreras aprobadas permanecen sin reducción: SNR ≥ 1,50, al menos 6 IBI,
  MAD/mediana ≤ 0,12, rango IBI ≤ 300 ms, al menos 6 coincidencias y 5 s limpios;
- cuarentena de 4 s ante movimiento fuerte, transitorio óptico o tiempo inválido.

El umbral sensible sólo crea candidatos. No puede publicar FC por sí solo: todavía
debe superar todas las barreras de fusión y validez anteriores.

## Datasets inmutables

| Escenario | Filas | SHA-256 |
|---|---:|---|
| Sin dedo | 500 | `68A60CFDF93E00FA14D018C970167D6B6CF97E75BA4629B5949D6536A33F4D96` |
| Dedo quieto, timeline A | 2251 | `D8920392C7C2B51BACB70328321596278B78D51315B1BC49D37C4BAC66C1FCE1` |
| Dedo quieto, LED 35 | 2252 | `F59C90CD88C80594BD540C003B8A352A4CBC2938FFC0FF54EBF5AF3EC68EF6A0` |
| Cambio de contacto | 2250 | `2FB5E581DE1247BA5DA287E8FE6F999245CA1B4765A5516E7B1F7D4DFDE1E716` |

Los hashes se verificaron antes de interpretar los resultados. Los CSV originales
no fueron modificados.

## Resultados físicos reproducidos

| Escenario | Fused | Valid | Mayor tramo válido | Mediana FC | Cuarentenas / recalibraciones | Publicación insegura |
|---|---:|---:|---:|---:|---:|---:|
| Sin dedo | 0 | 0 | 0 ms | — | 0 / 0 | 0 |
| Dedo quieto, timeline A | 93 | 390 | **12.600 ms** | **86 lpm** | 1 / 1 | 0 |
| Dedo quieto, LED 35 | 98 | 21 | 400 ms | 79 lpm | 0 / 0 | 0 |
| Cambio de contacto | 46 | 0 | 0 ms | — | **4 / 4** | 0 |

Comprobaciones específicas:

- sin dedo: `fused=0` y `valid=0`;
- timeline estable: tramo continuo válido ≥ 10 s y mediana dentro de 75–95 lpm;
- ningún dataset publicó FC con `unsafe_valid`, `single_channel_valid` o
  `valid_during_quarantine` distintos de cero;
- el cambio de contacto provocó cuatro cuarentenas y cuatro recalibraciones;
- LED 35 nunca publicó FC por evidencia de un solo canal.

Los resultados estructurados están en
`measurements/biosys-1.0.16/replay-results.json`. Los registros serie principales
son `replay-no-finger.log`, `replay-stable-timeline-sensitive-fir.log`,
`replay-led35-stable.log` y `replay-contact-change.log` en el mismo directorio.

## Regresión en hardware

Se ejecutaron 23 autotests sobre el ESP32 real y todos finalizaron con `PASS`:

- canal débil y valor atípico;
- fusión emparejada, rojo solo, IR solo, separación excesiva, hueco largo y
  rollover temporal;
- límites ópticos de 7 % y 9 %;
- movimiento moderado aislado, moderado sostenido, severo y saturación;
- recuperación y reinicio de calibración;
- señal estable sintética a 80 lpm, con 10.470 ms continuos válidos;
- temporización falsa, salto de secuencia y tiempo invertido;
- proporción de canales inválida;
- SNR 1,49 rechazado y frontera SNR 1,50 aceptada;
- pérdida de contacto después de un estado válido.

Resultado agregado: `REGRESSION_TOTAL=23 FAILED=0`.

## Uso de memoria de la imagen de replay

- programa: 486.680 bytes, 37 % de 1.310.720 bytes;
- variables globales: 37.252 bytes, 11 % de 327.680 bytes;
- RAM restante estimada para variables locales: 290.428 bytes.

La imagen escrita en la placa fue verificada por `esptool` con
`Hash of data verified`.

## Limitaciones pendientes

- No hubo oxímetro comercial para comparación simultánea.
- La captura LED 35 sólo sostuvo `VALID` durante 400 ms; se conserva como evidencia
  de seguridad y sensibilidad, no como aceptación del rendimiento sostenido.
- La aceptación clínica y los límites médicos requieren un protocolo separado,
  sujetos suficientes y equipo de referencia certificado.

## Aceptación física nueva del 25-09-2026

Se cargó la imagen RESEARCH en el mismo ESP32 clásico mediante el cargador ROM,
a 57.600 baudios, sin stub ni compresión y escribiendo sólo la aplicación en
`0x10000`. La escritura de 1.186.608 bytes terminó al 100 % con
`Hash of data verified`.

El binario recompilado y efectivamente escrito tuvo SHA-256
`F12E08EB983F50BD8245092FB93C48966FFA9F4E4BD3A878E9A79BC4B6A5FAFB`.
Este hash no coincide con el binario histórico documentado antes de la
transferencia entre computadoras; por trazabilidad se conserva el hash real de
la imagen probada y no se afirma equivalencia byte a byte.

El arranque físico confirmó:

- `VitalWatch VW-BIOSYS 1.0.16`;
- `VW-SYS 0.9.9`;
- `VW-BIO 0.7.0`;
- `MAX30102 PART_ID=0x15`.

`PPG-DUAL-CHANNEL-A` está configurado en el código, pero esta compilación no lo
emitió como línea independiente durante el arranque observado. La salida CSV y
el modo `BIO_RESEARCH_MODE=1` sí quedaron confirmados físicamente.

### Artefactos inmutables

| Artefacto | SHA-256 |
|---|---|
| `20260925-112619-dedo-quieto-dual-channel-a-toma-1.csv` | `EDB7C809B1E34D49878A78B83497D3A205505FAE77DA7EA48F2716997540F52A` |
| `20260925-112619-dedo-quieto-dual-channel-a-toma-1.json` | `B2F87433183632C251D59B5077D5ED549736F047D2BBAF35642B10A8CBFFC5CA` |

La captura y sus metadatos originales no se modificaron después de calcular
estos hashes. El análisis estructurado separado está en
`20260925-112619-dedo-quieto-dual-channel-a-toma-1-acceptance.json`.

### Puerta de aceptación

| Criterio | Resultado | Estado |
|---|---:|---|
| Registros | 2.251 | PASS |
| Filas descartadas | 0 | PASS |
| Deltas consecutivos | 2.250 de 2.250 a 40.000 us | PASS |
| `suspected_drops` / muestras faltantes | 0 / 0 | PASS |
| Mayor tramo `VALID` | 0 ms | **FAIL** |
| `VALID` con movimiento, transición óptica o tiempo inválido | 0 | Sin publicación `VALID` |
| Contribución fusionada rojo/IR en cada `VALID` | No evaluable: hubo 0 `VALID` | FAIL global |

### Diagnóstico de la irregularidad

La señal no falló por ausencia de contacto, SNR ni pérdida temporal. Se
registraron 83 candidatos rojos, 88 infrarrojos, 77 pulsos fusionados y 69 IBI.
Sin embargo, los IBI aceptados cubrieron de 340 a 1.600 ms. El firmware marcó
`QR_IBI_INCONSISTENT` durante 886 filas y nunca entró en
`TECHNICALLY_VALID`.

También aparecieron dos transitorios ópticos, a los 23,08 s y 37,72 s, con sus
cuarentenas y recalibraciones correspondientes. No hubo `QR_HIGH_MOTION`,
`QR_TIMING_INVALID`, muestras faltantes ni pérdidas sospechadas.

Hipótesis rechazada: **la supresión no máxima de 320 ms y la fusión rojo/IR
bastan para producir IBI coherentes en una toma real con dedo quieto**. La
captura muestra máximos secundarios fusionados y pulsos omitidos que alternan
intervalos cortos y largos, aunque ambos canales tengan SNR suficiente.

### Decisión

**REJECTED — KEEP RESEARCH.** BIOSYS 1.0.16 continúa como candidato de
investigación. No se cargó ni se liberó la imagen normal. La siguiente
corrección debe modificar una sola hipótesis de selección temporal y volver a
ejecutar controles negativos, replays y una nueva toma física antes de decidir
la liberación.

## Segunda toma física del 25-09-2026

Se repitió la captura durante 90 segundos después de reubicar el dedo y esperar
15 segundos de estabilización. Se mantuvieron la misma placa, imagen RESEARCH,
configuración y puerto serie de la primera toma.

### Artefactos inmutables

| Artefacto | SHA-256 |
|---|---|
| `20260925-113734-dedo-quieto-dual-channel-a-toma-2.csv` | `9A75A8C7929384DE0A7282767251F7339646B6173A365104AFE665100AC8B685` |
| `20260925-113734-dedo-quieto-dual-channel-a-toma-2.json` | `B1C47CAF77626DEC6DB6E43F7EAEDC46546BC7DD0BCF25DE3670ECC930971990` |

Los archivos de captura no se modificaron después de calcular estos hashes. La
evaluación estructurada separada está en
`20260925-113734-dedo-quieto-dual-channel-a-toma-2-acceptance.json`.

### Puerta de aceptación

| Criterio | Resultado | Estado |
|---|---:|---|
| Registros | 2.250 | PASS |
| Filas descartadas | 0 | PASS |
| Deltas consecutivos | 2.249 de 2.249 a 40.000 us | PASS |
| `suspected_drops` / muestras faltantes | 0 / 0 | PASS |
| Mayor tramo `VALID` | 4.160 ms | **FAIL** |
| `VALID` con movimiento, transición óptica o tiempo inválido | 0 | PASS |
| `VALID` con menos de seis coincidencias rojo/IR | 0 | PASS |

La nueva posición mejoró el resultado: hubo 104 muestras `VALID` consecutivas,
equivalentes a 4,16 segundos. Durante ese tramo la FC técnica estuvo entre
69,77 y 71,43 lpm, con mediana de 71,43 lpm. Esto no constituye validación
clínica porque no hubo un instrumento de referencia simultáneo.

En el conjunto completo se registraron 90 candidatos rojos, 96 infrarrojos, 80
pulsos fusionados y 69 IBI. Los IBI todavía abarcaron de 340 a 1.600 ms y
`QR_IBI_INCONSISTENT` apareció en 838 filas. Hubo un transitorio óptico con su
cuarentena y recalibración; no hubo movimiento alto, fallas temporales, muestras
faltantes ni pérdidas sospechadas.

Hipótesis rechazada: **reubicar el dedo y estabilizarlo durante 15 segundos basta
para sostener una lectura técnicamente válida durante al menos 10 segundos con
la configuración `PPG-DUAL-CHANNEL-A` actual**.

### Decisión de la segunda toma

**REJECTED — KEEP RESEARCH.** La señal mejoró, pero no alcanzó el tramo continuo
obligatorio de 10 segundos. No se cargó la imagen normal. La próxima iteración
debe aislar una sola modificación del selector temporal de pulsos, repetir los
replays y controles negativos, y volver a comprobarla físicamente.
