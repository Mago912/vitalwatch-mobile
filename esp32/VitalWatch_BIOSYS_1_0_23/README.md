# VitalWatch BIOSYS 1.0.23 DIAG — localizar el congelamiento

Fecha: 2026-09-28. ESP32 clásico NodeMCU 38 pines.
Versión de diagnóstico separada de BIOSYS 1.0.22; **no es una corrección del
bloqueo ni una nueva validación de FC**. SYS 0.9.9 y BIO 0.7.5 se conservan.

## Qué hace, en palabras simples

El firmware deja una marca antes de cada grupo de tareas. Otro observador,
ejecutándose en el núcleo opuesto al bucle Arduino, consulta esa marca cada
100 ms. Si la misma marca no avanza durante al menos dos segundos observados,
guarda el primer aviso. Se trata de una pausa sospechosa, no de prueba de la
causa: la tarea podría continuar después.

Un emisor independiente intenta enviar una sola línea `FREEZE,1,STALL,...`.
Si ese envío se bloquea, el observador no depende de que termine. Esto supone
que el planificador aún pueda ejecutar el observador: no cubre un bloqueo de
todo el sistema, interrupciones detenidas, alimentación defectuosa o pérdida
total de UART. La línea puede no llegar; su ausencia no descarta bloqueo.

No se cambian filtros, umbrales, pines, frecuencia I2C, biblioteca MAX3010x,
recuperaciones, algoritmos FC/SpO2 ni MPU. No se añade reinicio automático.
Las marcas y tareas añaden carga y memoria; el efecto temporal real debe
medirse en la placa. No se promete impacto cero.

## Archivos y bloques

| Archivo | Función |
| --- | --- |
| `FreezeTrace.h` | Identificadores de etapa y ámbito que restaura la etapa padre al salir. |
| `FreezeTraceModel.h` | Regla de dos segundos, primer aviso y checksum del registro. Probado en PC con entradas sintéticas. |
| `FreezeTrace.cpp` | Marcas atómicas, observador, memoria RTC y emisor único. No modifica resultados del sensor. |
| `VitalWatch_BIOSYS_1_0_23.ino` | Marcas entre tareas existentes; arranca diagnóstico al final de setup; nuevo comando J. |
| `Sensor_Oxigeno.cpp` | Marcas alrededor de lectura FIFO, metadatos, muestra, ganancia, detectores, SpO2 y publicación. |
| `PpgComparisonDiagnostic.h` | Marca el cálculo/envío HRPAIR existente; mantiene su esquema. |
| `Configuracion.h` | Producto 1.0.23, rol `FREEZE_DIAGNOSTIC_ONLY`, experimento `FREEZE-TRACE-23-A`. |

De las 32 cabeceras/C++ heredadas, **29 son idénticas byte a byte** a 1.0.22.
Las otras tres son configuración, marcas PPG y marcas HRPAIR; además cambia
el `.ino`. Los tres archivos `FreezeTrace*` son nuevos. El recibo de 1.0.22
sigue validando sus 37 archivos. La configuración privada no se imprime y
continúa ignorada por Git; no compartirla ni compartir binarios con credenciales.

## Interpretar una etapa

El campo `word` combina contador y etapa: `etapa = word & 255` y
`contador = word >> 8`. Cambiar contador aun en la misma etapa demuestra que
hubo marcas nuevas. La etapa retenida señala la última operación iniciada
sin una marca posterior; **no es una traza de pila ni demuestra qué instrucción
falló**. Los ámbitos anidados restauran su padre y también avanzan el contador.

| Etapa | Sector observado |
| --- | --- |
| 1 | Inicio del bucle |
| 2 | Aplicación de controles remotos |
| 3 | Botones |
| 4 | Comandos serie (`SERIAL_INPUT`, evita macro Arduino) |
| 5 | Servicio MPU y preparación de pista de movimiento |
| 6 | Servicio PPG, fuera de sus marcas internas |
| 7 | Medicación y eventos de mensajería |
| 8 | Configuración WiFi |
| 9 | Telemetría periódica |
| 10 | Gestión de caída |
| 11 | Eventos de impacto, splash y avisos |
| 12 | Actualización TFT |
| 13 | Research y métricas del bucle |
| 14 | Cesión al planificador |
| 20 | `sensor.check()` de la biblioteca MAX3010x |
| 21 | Lectura de punteros y contador FIFO |
| 22 | Procesamiento de muestra/contacto/sesión |
| 23 | Autoganancia existente |
| 24 | Detectores, fusión, gate y diagnóstico de picos |
| 25 | Ventana SpO2 y algoritmo MAXIM |
| 26 | Publicación de resultados |
| 27 | Construcción/envío HRPAIR |
| 28 | Envío de consulta J |
| 29 | Recuperación FIFO ya existente ante cantidad imposible |

## Salida serie, sin datos privados

A 115200 baudios, `Q` conserva HRPAIR-1 y `J` imprime dos líneas:

```text
FREEZE,1,LIVE,word,polls,firstWord,observerStarted,reporterStarted,resetReason
FREEZE,1,PREV,valid,word,observedMs,polls,firstWord,firstAtMs,firstAgeMs
```

El emisor separado, sin necesidad de Q/J, intenta una sola vez:

```text
FREEZE,1,STALL,firstWord,polls
```

Los campos LIVE son instantáneas orientativas independientes, no una lectura
fisiológica coherente. La marca LIVE corresponde al envío de J (etapa 28).
`polls` permite comprobar que corre el observador; `observerStarted=0` o
`reporterStarted=0` indican fallo al reservar una tarea. No continuar una toma
larga si esas tareas no arrancan. Cada tarea reserva 3.072 bytes de pila del
heap, más su estructura de control; el emisor termina después de enviar.

## Memoria RTC y límites

El observador guarda un registro de 36 bytes con checksum y magic escrito al
final. Es el único escritor. Al arrancar, el bucle copia la evidencia anterior
antes de iniciar las tareas; J puede consultar esa copia repetidamente.

- No se escribe flash/NVS para guardar el diagnóstico.
- No se debe asumir supervivencia tras EN/RESET, desconectar USB o caída de
  alimentación. Power-on/brownout se descartan explícitamente aunque hubiese
  un checksum coincidente. La retención tras un reinicio compatible sigue
  pendiente de comprobación física; no constituye un mecanismo garantizado.
- Un reinicio durante la escritura puede invalidar el registro. El checksum
  detecta alteraciones, no garantiza recuperar todo ni elimina colisiones.
- Se conserva la **primera** pausa observada de dos segundos, incluso si se
  recupera. Un congelamiento posterior podría ser diferente: comparar también
  la última etapa y hora retenidas.
- El setup anterior al arranque del observador no está cubierto.
- Si el otro núcleo o todo el planificador se detiene, el observador tampoco
  puede registrar nuevos datos.
- Este diagnóstico no puede recuperar retrospectivamente la causa del bloqueo
  actual de 1.0.22. Necesitamos reproducirlo después de cargar 1.0.23.

## Pruebas y preparación

Desde `D:\vitalwatch-mobile`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-freeze-trace-tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-freeze-capture.ps1
node scripts/run-hrpair-native-tests.mjs --version=1.0.23 --require-immediate
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-biosys-version-paths.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-compare-build -BiosysVersion 1.0.23
```

Con carga previamente coordinada, BOOT hasta `Writing...`, sin pedir RESET:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/esp32-firmware.ps1 -Action biosys-compare-upload -BiosysVersion 1.0.23 -Port COM3
```

Primera comprobación **corta y sin dedo**, solo después de carga verificada:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/capture-biosys-freeze.ps1 -Port COM3 -DurationSeconds 20 -Label sin-dedo-post-carga
```

El nuevo capturador envía J al iniciar y Q aproximadamente una vez por segundo.
Termina ante STALL, diez segundos sin HRPAIR estructuralmente completo, error
serie o duración agotada. Las líneas FREEZE quedan en `.freeze.log`, HRPAIR en
`.hrpair.log` y resultados en `.json`, dentro de `measurements/biosys-1.0.23-freeze`.
Solo guarda tramas diagnósticas numéricas; cuenta y descarta otros mensajes,
tramas malformadas y fragmentos excesivos. No guarda secretos de mensajes de red.
La versión es etiqueta del operador, no identificación automática del equipo.
El parser científico HRPAIR se ejecuta después y puede rechazar tramas que
superaron la validación estructural. Fin por duración no significa FC válida.

Si esa comprobación es íntegra, preparar otra corta con dedo. Si vuelve a
congelarse, guardar los archivos y revisar STALL; no repetir tomas largas ni
reiniciar antes de coordinar la recuperación de la evidencia.

## Verificación de software (no física)

**CODEX REPRODUCTION TESTS**, sin atribución a tests de Cowork:

- Modelo: 22 casos iniciales, 7 fallos con implementación vacía; después cero.
  Suite final: 24 casos incluyendo restauración de ámbitos y compatibilidad
  con macro SERIAL de Arduino.
- Capturador: 12 casos, inicialmente 9 fallos; después cero, incluida la
  pérdida de respuestas después de recibir las primeras.
- Publicación/fusión heredada: 36 casos aprobados sobre fuentes 1.0.23.
- Suite Node local seleccionada: 31 pruebas aprobadas. No hay `npm test`
  general; la suite remota de seguridad queda fuera del alcance.
- Comparación de rutas: 1.0.21/22/23 separadas; predeterminado conserva 1.0.21.
- Revisión independiente de solo lectura: sin hallazgos bloqueantes en las
  marcas, observador y emisor, sujeta a compilación y validación física.

La revisión del capturador detectó un caso adicional: dos respuestas serie
recibidas juntas pueden compartir milisegundo del host. Se reprodujo el
rechazo en el parser y se corrigió para aceptar igualdad, pero seguir rechazando
retrocesos. No se inventan milisegundos distintos ni duración válida entre
esas filas. Su prueba pasó de fallo a aprobación; no cambia datos del ESP32.

La compilación inicial señaló que Xtensa define `ATOMIC_INT_LOCK_FREE=1`:
se verificaron las únicas operaciones usadas, load/store relajados de 32 bits,
con el compilador exacto `esp-x32/2601` y la prueba `freeze_trace_atomic_probe.cpp`.
El ensamblador resultante usa `l32i`/`s32i` y `memw`, sin llamadas auxiliares.
También se corrigió la colisión del nombre SERIAL con Arduino y se agregó su
prueba. El ejecutor nativo compila sin excepciones/RTTI, que no usa esta prueba.

Advertencias preexistentes: dos inicializadores parciales en fusión y avisos
Node de tipo de módulo. La primera ejecución de Zig con caché vacía emitió
avisos de su libunwind; el ejecutor definitivo usa el compilador C con fuente
C++ sin excepciones y la caché portable, y sus 24 casos terminaron sin avisos.

## Compilación final y entrega

Compilación completa **HRPAIR-1 + FREEZE**, plataforma ESP32 3.3.11,
`esp32:esp32:esp32`: código de salida 0.

- Programa: **1.187.544 / 1.310.720 bytes (90%)**, aumento de 2.300 bytes
  respecto a 1.0.22 HRPAIR-1.
- Variables globales: **56.656 / 327.680 bytes (17%)**, aumento de 56 bytes;
  quedan 271.024 bytes para pila y memoria dinámica antes de las reservas del
  runtime. Las dos pilas nuevas consumen otros 6.144 bytes de heap, más sus
  estructuras de control; esto no está incluido en esos 56 bytes globales.
- Binario `.arduino/build/biosys-1.0.23-hrpair/VitalWatch_BIOSYS_1_0_23.ino.bin`:
  **1.187.696 bytes**.
- SHA256: `FD5EB1057ADC0AFE9D7537811AF5C5B5DB566680DE7B650191E378E77F383B83`.
- Recibo `HRPAIR_BUILD.json`: **40 entradas coincidentes** verificadas después
  de terminar el build. No abrió COM ni cargó firmware.

No se compiló otro perfil normal/Research/Replay 1.0.23. **No instalado**;
el último firmware cargado continúa siendo 1.0.22. No se reinició la placa
durante esta preparación ni se intentó corregir el bloqueo a ciegas.

Las guías de pruebas primero, diagnóstico y revisión independiente ayudaron
a separar fallos de herramientas de la avería física y a verificar el cambio
antes de cargarlo. La siguiente evidencia necesaria es la prueba real; los
tests en PC no prueban retención RTC, ejecución entre núcleos ni calidad de FC.
