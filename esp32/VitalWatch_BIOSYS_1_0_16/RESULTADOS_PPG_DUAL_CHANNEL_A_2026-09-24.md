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
