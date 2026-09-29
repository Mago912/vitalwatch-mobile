# Publicación de FC e historial de pulsos: reproducción independiente

Fecha local: 2026-09-28. **CODEX REPRODUCTION TESTS**.

## Resultado entendible

Se ejecutaron las funciones C++ de publicación y fusión en la PC con entradas
controladas. No se cambió el firmware instalado ni se abrió el puerto serie.
Quedaron reproducidos tres comportamientos problemáticos de publicación:

1. Una FC válida que dura poco puede terminar antes de que se publique.
2. Si el cálculo pasa de VALID a UNSTABLE conservando un número, la salida
   publicada puede continuar diciendo VALID hasta la siguiente publicación.
3. La mediana que acompaña un nuevo estado VALID puede incluir números de
   resultados anteriores que eran UNSTABLE.

Esto es evidencia de componentes del software, no una nueva medición humana.
El segundo y tercer caso fueron reproducidos con entradas sintéticas; **no se
afirma que ocurrieran en la primera captura HRPAIR**, que no mostró consultas
con publicado VALID e interno no válido.

## Pruebas y salidas

```powershell
node scripts/run-hrpair-native-tests.mjs
node scripts/run-hrpair-native-tests.mjs --require-immediate
```

- Caracterización del baseline: **16 casos, 0 fallos, salida 0**. Confirma que
  el código hace lo observado, incluidos los comportamientos no deseados.
- Contrato propuesto de publicación inmediata y mediana sin valores
  inestables: **16 casos, 3 fallos, salida 1**. Los tres fallos son los puntos
  enumerados arriba. El firmware **todavía no cumple** ese contrato.
- Regresiones Node: **30 pruebas aprobadas**, incluyendo HRPAIR, Replay,
  lecturas, horarios y enlaces Telegram. No hay un comando `npm test` general.
  No se ejecutó `test:security`, porque utiliza el servicio remoto y queda
  fuera de estas pruebas locales del firmware.
- Recibo de compilación HRPAIR: **37 archivos coincidentes** al terminar.

Informes generados con hashes de fuentes y salida completa:

- `.arduino/build/hrpair-native/baseline-characterization.json`
- `.arduino/build/hrpair-native/proposed-immediate-contract.json`

La compilación nativa generó dos avisos `missing-field-initializers` en
`PpgBeatFusion.cpp` (líneas 33 y 78); los campos restantes de estos agregados
se inicializan a cero y luego se completan con métricas. No se modificaron.
La preparación inicial de Zig también emitió avisos `dllexport` en libunwind.
Las pruebas Node mantuvieron los avisos `MODULE_TYPELESS_PACKAGE_JSON`.
No se presenta esta ejecución como libre de advertencias.

## Casos de publicación reproducidos

| Entrada controlada | Resultado del baseline |
| --- | --- |
| VALID a 1000 ms, UNSTABLE a 2000 ms, publicación a 5000 ms | No se publica el período VALID. |
| VALID a 5000 ms, UNSTABLE con 62,5 lpm a 5040 ms | Continúa publicado VALID hasta la siguiente publicación. |
| VALID seguido por UNSTABLE con NaN | Se invalida inmediatamente y se vacía la mediana. |
| Pérdida de contacto con NaN, invocando publicación | Se refleja inmediatamente y se vacía la mediana. |
| Solo entradas UNSTABLE durante toda la secuencia | Nunca se convierten en VALID por sí solas. |
| Cuatro valores UNSTABLE de 70 lpm y uno VALID de 90 lpm | Se publica 70 lpm con estado VALID, por la mediana mezclada. |

Los últimos números son deliberadamente sintéticos, no datos de una persona.
El ensayo comienza después del cálculo biomédico: prueba qué hace publicación
si recibe esas entradas, no si el detector generaría esa secuencia exacta.

## Historial de fusión

También se ejecutó directamente `PpgBeatFusion.cpp` con candidatos rojo/IR
emparejados:

- Nueve pares separados 1000 ms construyen ocho IBI y un resultado de 60 lpm.
- Si falta el siguiente par y el próximo llega a los 2000 ms, se activa
  `historyReset`, se vacía el historial y el BPM queda NaN.
- El próximo par a 1000 ms genera un solo IBI: no restaura el historial viejo.
- 1600 ms se acepta; 1601 ms provoca vaciado.
- 329 ms se rechaza sin vaciar; 330 ms se acepta desde el último par aceptado.
- Canales separados 121 ms no forman un par.

**La ruta de reinicio está reproducida, pero su causa física sigue pendiente.**
Las consultas de la toma a 1 Hz no indican exactamente qué pulso faltó ni si
la causa fue contacto, detector, sincronización o adquisición. Tampoco todos
los vaciados deben atribuirse a esta ruta: el sistema tiene reinicios por
calibración y cuarentena. No se modifica el límite de 1600 ms para compensar
una causa que todavía no está identificada.

## Alcance y trazabilidad

El runner toma literalmente de las fuentes actuales las funciones y el estado
de publicación, además de sus tipos y constantes. Compila el archivo de fusión
original. El reloj se controla en la prueba. No ejecuta adquisición I2C, TFT,
Wi-Fi, ni el detector de máximos: no es una prueba integral del ESP32.

Fuentes clave comprobadas:

- `Sensor_Oxigeno.cpp`: `79435e3cc32c259e8a8d49df5344a59727e03d6ab9852e95abd868c75fb124e8`
- `PpgBeatFusion.cpp`: `32bd2bf225e18387582acf6fc6c2be816234268b65a4fbe189b4f510c8f238db`

Se añadió un compilador Zig 0.13.0 portátil en `.tools`, con SHA256 oficial
verificado, sin instalación global. El procedimiento y sus límites están en
`esp32/tests/hrpair_native/README.md`. Los archivos nuevos de código son solo
el runner y las pruebas; no hay cambios a fuentes del firmware o la app.

No se utiliza `FINAL_BIOMED_CANDIDATE` ni se declara equivalencia con Cowork.
Las guías de diagnóstico sistemático y verificación se aplicaron para separar
reproducción, contrato todavía incumplido y evidencia física pendiente.

## Próxima corrección propuesta, todavía no aplicada

Separar la publicación del **estado** de la suavización del **número**:

1. Publicar los cambios de estado sin esperar cinco segundos.
2. Retirar el estado VALID inmediatamente al dejar de cumplir sus condiciones.
3. No usar valores UNSTABLE para suavizar un número etiquetado VALID; reiniciar
   ese historial al perder validez.
4. Mantener intactos detector, fusión, confirmación temporal, umbrales, MPU,
   alertas y adquisición. Probar los bordes antes de compilar otro firmware.

Después se necesitará una nueva captura física comparable. Corregir cómo se
publica una lectura no mejora por sí solo la calidad de la señal ni demuestra
exactitud clínica. El dispositivo sigue con BIOSYS 1.0.21 HRPAIR-1.
