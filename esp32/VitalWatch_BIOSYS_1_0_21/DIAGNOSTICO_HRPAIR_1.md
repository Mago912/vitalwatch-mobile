# BIOSYS 1.0.21 — diagnóstico HRPAIR-1

Fecha: 2026-09-28. Evidencia: **CODEX REPRODUCTION TESTS**.

## Qué problema queremos separar

La captura Research registra `hr`, el resultado instantáneo del algoritmo.
El comando normal `P` registra `hrDisplay`, el resultado preparado para la
pantalla. No son la misma variable. `publishDisplayResults()` aplica una
mediana y una cadencia de publicación de 5 segundos; un resultado UNSTABLE
con BPM numérico puede permanecer pendiente hasta la siguiente publicación.
Por eso no corresponde comparar directamente los porcentajes VALID de ambos
tipos de captura ni concluir que la diferencia la causa el modo Research.

HRPAIR-1 toma ambos resultados en la misma consulta, en el bucle que procesa
los sensores. Es instrumentación para investigar; **no es una corrección del
detector ni una nueva versión biomédica**.

## Cambios y límites

- `PpgComparisonDiagnostic.h`: copia los dos resultados, diagnósticos PPG,
  muestra y métricas; después emite una línea acotada por el puerto serie.
- El `.ino` añade el comando `Q`/`q` y un aviso de arranque, solamente con
  `BIO_COMPARE_MODE=1`. Rechaza combinar este perfil con Research o Replay.
- No se modifican los filtros, umbrales IBI, fusión rojo/IR, ganancia, pines,
  MPU, lógica de pantalla, aplicación ni alertas.
- El perfil mantiene el funcionamiento normal de BIOSYS 1.0.21, SYS 0.9.9 y
  BIO 0.7.4, a 115200 baudios. El comando `P` conserva su comportamiento.
- La escritura serie consume tiempo: la instrumentación no es de impacto
  nulo. Se registran pausas de servicio, pérdidas y overflow para evaluarlo.
- `display` es el resultado preparado para pantalla, **no prueba de que el TFT
  haya repintado ese valor**. Sus timestamps son los del resultado de origen,
  no los instantes de repintado.

## Formato serie, esquema 1

Una respuesta contiene 28 campos separados por coma y termina en salto de
línea. La captura antepone `host_elapsed_ms|`, medido al recibir la línea
completa. El archivo del analizador contiene el orden exacto en `FIELDS`.

| Campos | Significado |
| --- | --- |
| `type,schema` | Identificador `HRPAIR,1`. |
| `now_us,session_id,sample_index,contact` | Reloj ESP32, sesión de contacto, secuencia y contacto detectado. |
| `instant_status,instant_bpm,instant_flags,instant_us` | Estado, BPM, razones de calidad y timestamp de `hr`. |
| `display_status,display_bpm,display_flags,display_us` | Los mismos datos para `hrDisplay`. |
| `ibi_count,ibi_range_ms,ibi_mad_ratio` | Cantidad, rango y dispersión relativa de intervalos entre pulsos. |
| `sync_count,sync_window` | Coincidencias rojo/IR y tamaño de su ventana. |
| `red_snr,ir_snr` | Indicadores internos señal/ruido por canal. |
| `timing_invalid_total,missing_samples,sw_drops,hw_ovf` | Diagnósticos temporales y FIFO; no se deben sumar como si fueran eventos independientes. |
| `service_gap_us,service_gap_max_us` | Pausa actual y máxima entre servicios PPG. |
| `imu_valid` | Disponibilidad de la muestra IMU; con MPU desconectado no demuestra inmovilidad. |

VALID es estado 0. Un BPM numérico en otro estado no se cuenta como válido.
`nan` conserva un valor ausente. El analizador rechaza esquemas desconocidos,
líneas incompletas/mezcladas y valores numéricos incompatibles.

## Herramientas añadidas

- `scripts/biosys-hr-pair.mjs`: separa validez instantánea/publicada, cuenta
  desacuerdos y razones, calcula desfase entre timestamps de origen y tramos
  observados. Distingue reinicios de reloj, cambios de sesión y retrocesos de
  secuencia; corta los tramos ante cualquiera de ellos o huecos >1500 ms.
- `scripts/test-biosys-hr-pair.mjs`: seis pruebas sintéticas independientes,
  no mediciones humanas ni tests originales de Cowork.
- `scripts/capture-biosys-hr-pair.ps1`: consulta aproximadamente a 1 Hz,
  conserva respuestas en `.log` y metadatos en `.json`, sin accionar DTR/RTS
  deliberadamente. Aborta si no recibe HRPAIR en 7 segundos.
- `scripts/esp32-firmware.ps1`: acciones separadas de compilar/cargar. Guarda
  hashes locales de fuentes y binarios; no carga si cambiaron tras compilar.
  Así no hay que mantener BOOT durante la compilación.

La captura no reemplaza el CSV crudo de 25 Hz. Dos consultas válidas no
garantizan validez continua entre ellas. Un contador FIFO en cero tampoco
demuestra por sí solo ausencia de pérdidas entre consultas.

## Procedimiento reproducible

Desde `D:\vitalwatch-mobile`, primero compilar sin tocar botones:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-compare-build
node --test scripts/test-biosys-hr-pair.mjs scripts/test-biosys-ppg-replay.mjs scripts/test-vitalwatch-readings.mjs
```

Confirmar el puerto real antes de cargar. En esta sesión se venía usando COM3.
Cerrar cualquier monitor serie. Solo cuando la compilación termine, mantener
BOOT/IO0, iniciar la carga y soltar al comenzar `Writing...`. No tocar RESET.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-compare-upload -Port COM3
```

Comprobar la verificación de carga y una respuesta `Q`. Después preparar una
captura de 120 s en el dedo, en reposo y con luz habitual, conservando el
montaje aislado del MAX30102. No cambiar sitio/presión deliberadamente en la
misma toma. Comparar muñeca/antebrazo en tomas separadas posteriores.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-biosys-hr-pair.ps1 -Port COM3 -DurationSeconds 120 -Label dedo-luz-habitual-toma-1
node scripts/biosys-hr-pair.mjs <ruta-al-log>
```

Los registros quedan en `measurements/biosys-1.0.21-hrpair`. Mantenerlos con el
proyecto local; no compartir configuración, recibos de compilación ni binarios
con credenciales integradas. No publicar automáticamente los registros.

## Criterio para la siguiente decisión

1. Si instantáneo pierde validez, estudiar sus razones y la señal cruda; no
   bajar umbrales para ocultar el problema.
2. Si instantáneo es válido pero lo publicado no, medir retrasos de publicación.
3. Si se conserva VALID publicado cuando instantáneo ya no es válido, registrar
   duración y circunstancias antes de proponer cambios de pantalla.
4. Si aumentan pausas, pérdidas u overflow, investigar la carga de adquisición
   antes de atribuir el fallo únicamente al contacto o a la fisiología.

Para volver al perfil normal se usa la acción existente `biosys-build` y luego
la carga normal coordinada con BOOT; esa ruta puede recompilar. El binario
normal previo se conserva en una carpeta distinta de HRPAIR.

## Estado de verificación

Las 20 pruebas Node seleccionadas pasaron (6 HRPAIR, 6 Replay y 8 lecturas de
la app). Ambos scripts PowerShell pasaron análisis sintáctico. Esto valida
herramientas y regresiones seleccionadas, **no la exactitud médica**.

Compilación HRPAIR confirmada con salida 0 para `esp32:esp32:esp32`:

- Programa: 1.185.240 / 1.310.720 bytes (90 %), +680 bytes frente al normal previo.
- Variables globales: 56.600 / 327.680 bytes (17 %), sin aumento frente al normal.
- Archivo `.ino.bin`: 1.185.392 bytes.
- SHA256 HRPAIR: `803EC04CC17BBF4C51C10C88B38963F0829C618AD3014C592D8F4E5E7F584F96`.
- Recibo local: 37 entradas, todas coincidentes con los archivos verificados.
- Binario normal conservado sin cambios, SHA256:
  `AB2A2035E3990FB473FA72D79641D6925172805CFD290F14DDBE46806850944D`.

La carga física se verifica por separado. Al finalizar esta preparación aún
no se había cargado HRPAIR ni realizado su primera captura. El último perfil
instalado registrado sigue siendo NORMAL. No se declara mejora de FC hasta
medirla; no se ha abierto el puerto serie durante esta preparación.

### Primer intento de carga: bloqueo previo al puerto serie

La acción de carga ejecutada con Windows PowerShell 5.1 se detuvo al validar
el recibo, antes de invocar Arduino CLI. No hubo escritura en el ESP32.
Los 37 archivos coincidían: la causa era `@( ... | ConvertFrom-Json)`, que
en ese intérprete conservaba el array JSON como un único elemento anidado.
Se corrigió a asignación directa, manteniendo la comprobación de hashes.

`scripts/test-hrpair-receipt.ps1` ejecuta la asignación real del script sin
cargar firmware: reprodujo el fallo antes del cambio y pasó después en
Windows PowerShell 5.1 y PowerShell 7, con 37 entradas coincidentes. Es una
prueba local que requiere el recibo de compilación vigente. Las 20 pruebas
Node seleccionadas volvieron a pasar; Node mantuvo su aviso preexistente
`MODULE_TYPELESS_PACKAGE_JSON` para `lib/vitalwatch-readings.ts`.

El binario y las fuentes del firmware no cambiaron; no hace falta recompilar.
En ese primer intento, la carga y la captura quedaron pendientes de volver a
coordinar BOOT.

### Carga confirmada y comprobación serie — 2026-09-28, 21:18

El segundo intento cargó HRPAIR-1 por COM3 en el ESP32-D0WD-V3. Se indicó
soltar BOOT al empezar la escritura, sin pedir pulsar RESET. Esptool escribió
1.185.392 bytes de aplicación y confirmó `Hash of data verified`; terminó con
código 0 y efectuó su reinicio automático mediante RTS. El SHA256 del binario
sigue siendo `803EC04CC17BBF4C51C10C88B38963F0829C618AD3014C592D8F4E5E7F584F96`.

Estado instalado actual: **BIOSYS 1.0.21, perfil de diagnóstico HRPAIR-1**.

Se ejecutó una comprobación serie de 10 segundos, sin protocolo físico de
contacto, a 115200 baudios. Archivo local:
`measurements/biosys-1.0.21-hrpair/20260928-211855-verificacion-serie-sin-protocolo-fisico.log`.
Hubo 10 respuestas completas, ninguna rechazada, sin huecos de consulta ni
reinicios detectados. No hubo FC válida; no es una prueba de rendimiento
porque todavía no se había coordinado la colocación del dedo.

El resumen conserva 10 discrepancias de estado interno/publicado (ninguno
VALID), una observación con timestamp de origen futuro y una pausa histórica
máxima de servicio de 188.508 microsegundos. No se ocultan estos diagnósticos
ni se atribuyen a una causa sin investigar. No hubo filas con overflow o
bandera de muestras ausentes en esta comprobación. IMU disponible: 0 filas.

Pendiente: captura controlada de 120 segundos con el dedo. La comunicación
correcta no demuestra mejora de FC ni validación médica.
