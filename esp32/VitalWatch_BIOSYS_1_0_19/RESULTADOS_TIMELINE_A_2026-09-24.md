# Resultados físicos PPG TIMELINE-A — 2026-09-24

## Alcance

Prueba física sobre ESP32 NodeMCU clásico de 38 pines y MAX30102. Esta prueba
evalúa integridad temporal y consistencia interna. No determina exactitud
clínica porque no se dispuso de ECG ni oxímetro comercial de referencia.

Archivo principal:

- `measurements/biosys-1.0.15/20260924-194014-dedo-quieto-timeline-a-toma-1.csv`

Control anterior:

- `measurements/biosys-1.0.15/20260924-191832-dedo-quieto-led-range-a-toma-2.csv`

## Integridad de adquisición

| Indicador | Antes, LED-RANGE-A | TIMELINE-A |
|---|---:|---:|
| Duración | 90,022 s | 90,000 s |
| Registros válidos | 2251 | 2251 |
| Filas descartadas | 0 | 0 |
| Intervalos exactos de 40000 us | 18/2250 | 2250/2250 |
| Intervalo mínimo–máximo | 26706–54825 us | 40000–40000 us |
| Pérdidas software sospechadas | 0 | 0 |
| Fallos I2C | 0 | 0 |

Resultado: la irregularidad temporal fue reproducida y corregida. El tiempo
de muestra ya no hereda el jitter del loop.

## Señal y frecuencia cardíaca

| Indicador | Antes, LED-RANGE-A | TIMELINE-A |
|---|---:|---:|
| LED | 24 | 24 |
| IR mediana | 79688 | 79131 |
| Modulación IR mediana | 0,0728 % | 0,0378 % |
| Picos aceptados | 38 | 54 |
| Estados IBI inconsistente | 956 | 136 |
| Estados baja pulsatilidad | 1004 | 2114 |
| FC válida | 0 | 0 |

Una FFT exploratoria sobre los últimos 80 s encontró el máximo común rojo/IR
en 1,3868 Hz, equivalente a 83,2 lpm. La prominencia frente a la mediana de la
banda 0,6–3 Hz fue 47,4 en IR y 29,0 en rojo, con correlación AC rojo/IR de
0,81. Esto demuestra periodicidad óptica interna, pero no exactitud clínica.

El detector aceptó 48 picos en esos 80 s. Una señal de 83,2 lpm contendría
aproximadamente 111 ciclos durante ese intervalo. Los IBI aceptados incluyen
repeticiones cercanas a 1,4 s, compatibles con omitir ciclos alternos.

## Interpretación controlada

1. La reconstrucción temporal continua funciona y debe conservarse.
2. La corrección redujo fuertemente los estados de IBI inconsistente.
3. La toma siguió sin FC válida porque el perfil LED bajo produjo una señal
   periódica, pero de muy poca amplitud y por debajo del criterio de calidad.
4. Todavía no corresponde relajar umbrales médicos ni publicar la estimación
   espectral como resultado de usuario.

## Próxima prueba recomendada

Mantener TIMELINE-A, filtros, detector, umbrales y MPU sin cambios. Modificar
solamente el perfil óptico de laboratorio para elevar el LED y repetir una
captura de 90 s. Esto permite comprobar si una mejor relación señal/ruido
recupera los ciclos omitidos antes de tocar el algoritmo de detección.

Decisión aprobada: ensayo `PPG-LED-35-TIMELINE-A`, con LED fijo `0x35` y dos
capturas consecutivas previstas. El éxito requiere `HeartRateStatus::VALID`;
un valor aproximado o `UNSTABLE` no satisface el objetivo.

## Resultado de `PPG-LED-35-TIMELINE-A`

Archivos:

- `measurements/biosys-1.0.15/20260924-195431-dedo-quieto-led-35-timeline-a-toma-1.csv`
- `measurements/biosys-1.0.15/20260924-195710-dedo-quieto-led-35-timeline-a-toma-2.csv`

El perfil se mantuvo realmente fijo en `0x35` (`53`) durante ambas tomas. La
reconstrucción temporal también se conservó: los 2251 intervalos de la toma 1
y los 2249 de la toma 2 fueron exactamente de `40000 us`. No hubo muestras
faltantes ni aumentó el contador de fallos I2C, que permaneció en 2 durante
cada archivo.

| Indicador | Toma 1 | Toma 2 |
|---|---:|---:|
| Duración | 90,040 s | 89,960 s |
| Registros | 2252 | 2250 |
| IR mínimo–mediana–máximo | 188135–189580–190502 | 2791–186377,5–203754 |
| Rojo mínimo–mediana–máximo | 165850–166105–168793 | 2672–162966,5–178200 |
| Modulación IR mediana | 0,0353 % | 0,1618 % |
| Modulación IR máxima | 0,1566 % | 73,7082 % |
| Modulación roja mediana | 0,0347 % | 0,1334 % |
| Modulación roja máxima | 0,1289 % | 71,3852 % |
| Picos custom / SparkFun / aceptados | 49 / 28 / 60 | 5 / 20 / 25 |
| Intervalo entre picos aceptados, mediana | 1040 ms | 2800 ms |
| Intervalo entre picos aceptados, rango | 400–4320 ms | 400–16760 ms |
| `VALID` | 0 | 0 |
| `INSUFFICIENT_DATA` | 250 | 394 |
| `UNSTABLE` | 183 | 1367 |
| `LOW_QUALITY` | 1814 | 489 |
| `TIMING_INVALID` | 5 | 0 |

La toma 1 mantuvo un contacto óptico estable y un nivel DC alto, pero la
modulación relativa continuó por debajo del requisito actual durante la mayor
parte del registro. La toma 2 incluyó una transición clara de contacto: los
mínimos rojo/IR cayeron a aproximadamente 2700 y la modulación calculada subió
transitoriamente por encima de 70 %. Esos valores no representan una mejora
fisiológica; son el efecto de cambiar o perder el acoplamiento del dedo.

### Reproducción del detector actual

Se reprodujo fuera del ESP32 la rama custom usando `ir_filtered` de la toma 1
y las mismas condiciones del firmware. El replay coincide en los 49 picos
custom registrados, sin discrepancias.

De 224 máximos locales:

- 49 cumplieron la condición custom;
- 54 fueron rechazados por `prev1 <= 8`;
- 119 fueron rechazados por amplitud inferior al umbral adaptativo;
- 2 fueron rechazados por el periodo refractario.

La amplitud pico-valle mediana fue `9,33`, mientras que el umbral adaptativo
mediano fue `29,23` y nunca bajó de `25`. Esto demuestra que elevar el LED
aumentó principalmente el nivel DC, pero no resolvió la detección de pulsos.

La toma 2 comienza cuando la sesión ya estaba en curso, por lo que no permite
reconstruir exactamente el estado previo del EMA. Aun así, el replay parcial
muestra el segundo problema: las transiciones grandes de contacto elevan el
umbral estimado a centenas o miles de unidades y el detector tarda en
recuperarse. Esta observación es coherente con solo 5 picos custom en 90 s.

## Decisión del ensayo

La hipótesis «un LED fijo más alto basta para obtener FC válida» queda
**refutada**. La corrección temporal permanece **confirmada**.

No se debe seguir aumentando el LED ni rebajar directamente los criterios de
validez. Antes de una nueva carga física se necesita un replay reproducible que
separe dos comportamientos:

1. detección de pulsos pequeños pero regulares sin depender de pisos absolutos;
2. recuperación del umbral después de artefactos de contacto sin convertir esos
   artefactos en FC válida.

El replay debe usar estas capturas como evidencia, conservar las salidas
`LOW_QUALITY`/`UNSTABLE` cuando corresponda y no presentar una FC como válida
sin consistencia temporal suficiente. Tampoco permite afirmar exactitud
clínica sin una referencia externa.
