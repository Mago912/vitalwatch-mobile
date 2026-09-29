# Cambios controlados: BIOSYS 1.0.22

Fecha: 2026-09-28. Implementación aprobada por el usuario después de las
pruebas de reproducción de BIOSYS 1.0.21. **CODEX REPRODUCTION TESTS**; no son
tests originales de Cowork y no se usa `FINAL_BIOMED_CANDIDATE`.

## Alcance aprobado

Corregir exclusivamente la publicación de frecuencia cardíaca preparada para
la TFT: estado inmediato, retirada inmediata de VALID y suavizado separado
de valores inestables. No intentar aumentar el porcentaje de FC válida
relajando filtros ni atribuir mejora física a un cambio visual.

Se preservó la carpeta 1.0.21. La nueva carpeta contiene las fuentes necesarias
para Arduino; no se copiaron informes antiguos como si fueran resultados de
esta versión. Se mantiene el formato HRPAIR-1 para poder comparar.

## Versiones

| Identificador | Valor | Motivo |
| --- | --- | --- |
| BIOSYS | 1.0.22 | Nueva entrega trazable. |
| SYS | 0.9.9 | Sin modificaciones funcionales del sistema. |
| BIO | 0.7.5 | Cambia publicación del servicio PPG, no el detector. |
| Algoritmo HR | `0x0701` | Sin cambios en detección ni criterios de validez. |
| Algoritmo SpO2 | `0x0604` | Sin cambios. |
| Calibración SpO2 | `0x0002` | Sin cambios. |
| Experimento | `PPG-PUBLICATION-22-A` | Identifica la corrección de salida. |

## Bloques cambiados

### A — `Sensor_Oxigeno.cpp`, estado de publicación

El comentario junto a `hrDisplay` aclara la separación entre estado inmediato
y número suavizado. No se añade un nuevo historial ni se amplía ningún buffer.

### B — `queueDisplayBpm()`

Solo admite resultados `VALID` con BPM finito y positivo. Conserva el tamaño
del historial y los criterios previos para añadir un valor (cambio de 0,5 lpm
o antigüedad de 200 ms). Los valores UNSTABLE no entran en la mediana.

### C — `publishDisplayResults()`

1. Evalúa si el resultado actual es VALID y numéricamente utilizable.
2. Cuando no es válido, copia inmediatamente estado, razones y timestamp al
   resultado publicado y limpia el historial de suavizado.
3. Como defensa, si recibe un resultado marcado VALID con NaN, infinito, cero
   o número negativo, publica `INSUFFICIENT_DATA`, NaN y calidad INVALID. No
   altera `hr` ni cambia la decisión original del detector.
4. Al entrar de nuevo en VALID, publica el resultado actual inmediatamente.
5. Dentro del tramo válido mantiene el número hasta la siguiente publicación
   programada; entonces usa la mediana del historial válido (o el valor actual
   si todavía hay menos de tres entradas).
6. No mueve el temporizador compartido por el simple hecho de cambiar el
   estado de HR, por lo que la cadencia SpO2 permanece intacta.

"Inmediato" significa en esa ejecución de la función de publicación, no una
garantía de latencia cero en el repintado físico de la TFT. El bucle, las
rutas de contacto y las comunicaciones no se reorganizaron.

### D — Identificación

`Configuracion.h` cambia producto, versión BIO e identificador de experimento.
El `.ino` se renombra para coincidir con la carpeta Arduino y actualiza el
comentario de identidad y el aviso de arranque HRPAIR. No cambia su lógica.

### E — Herramientas y pruebas

- `esp32-firmware.ps1`: selector explícito `BiosysVersion`, separado por
  carpeta, binario y recibo. El valor predeterminado sigue siendo 1.0.21.
- `capture-biosys-hr-pair.ps1`: selector `FirmwareVersion` para guardar y
  etiquetar las tomas por separado; aclara que no se detecta automáticamente.
- `run-hrpair-native-tests.mjs`: selector `--version=1.0.22`; genera y ejecuta
  las funciones reales de publicación y compila la fusión original.
- `reproduction.cpp`: amplía las pruebas con recuperación, metadatos,
  entradas inválidas, SpO2 y vuelta del contador `millis()`.
- `test-biosys-version-paths.ps1`: comprueba las rutas calculadas, preservación
  del valor predeterminado y rechazo de versiones desconocidas sin abrir COM.

## Evidencia RED → GREEN y regresiones

- Contrato ampliado sobre 1.0.21: **36 casos, 11 fallos** observados antes de
  cambiar producción. Incluye los tres defectos ya reproducidos y casos de
  recuperación/defensa que la publicación anterior no satisfacía.
- Mismo contrato sobre 1.0.22: **36 casos, 0 fallos**.
- Suite Node local seleccionada: **30 pruebas aprobadas**.
- Rutas de compilación: aprobadas en Windows PowerShell 5.1 y PowerShell 7.
- Sintaxis de scripts de firmware y captura: sin errores.
- Recibo 1.0.21: los **37 archivos siguen coincidiendo** con su compilación.
- Comparación de fuentes: **30 cabeceras/C++ idénticos byte a byte**; solo
  cambian `Configuracion.h` y `Sensor_Oxigeno.cpp`, además del nombre/identidad
  del `.ino`. Incluye preservación de detector, fusión, gate, FIFO, MPU,
  comunicaciones, alertas y configuración privada local.

Se mantienen dos advertencias nativas `missing-field-initializers` del archivo
de fusión original y avisos Node `MODULE_TYPELESS_PACKAGE_JSON`. No se
alteraron módulos ajenos para silenciarlos. La suite remota de seguridad no
forma parte de esta validación local; no hay un `npm test` general.

Informes locales, ignorados por Git:

- `.arduino/build/hrpair-native/proposed-immediate-contract.json` (baseline).
- `.arduino/build/hrpair-native-1.0.22/proposed-immediate-contract.json` (nuevo).

## Revisión independiente

Una revisión de solo lectura no encontró hallazgos críticos, importantes ni
menores en el cambio acotado. Comprobó fuentes, pruebas, hashes y selección
de versiones. Se dejaron explícitamente fuera de su veredicto la exactitud
del detector, medición física, repintado TFT y compilación completa del ESP32
(se verifican por separado).

La telemetría usa `heartRateForTelemetry()`, un resultado retenido distinto
de `hrDisplay`. Su comportamiento se preserva: **no se declara corregida la
frescura de datos de la app/nube** mediante esta modificación.

## Estado de entrega

Corrección implementada, pruebas nativas terminadas y compilación completa
del perfil HRPAIR-1 finalizada correctamente (código de salida 0).

- Programa: **1.185.244 de 1.310.720 bytes (90%)**, solo 4 bytes más que
  1.0.21 HRPAIR-1.
- Variables globales: **56.600 de 327.680 bytes (17%)**, sin aumento;
  quedan 271.080 bytes para variables locales y memoria dinámica.
- Binario: `.arduino/build/biosys-1.0.22-hrpair/VitalWatch_BIOSYS_1_0_22.ino.bin`,
  de **1.185.392 bytes**. El tamaño del archivo binario y la ocupación de
  programa informada por el compilador son magnitudes distintas.
- SHA256: `EDD5EB3097E4E00C36F8BE233F4829B0F9F07258B61B3EB971D26E4B8BF54125`.
- Recibo `HRPAIR_BUILD.json`: **37 archivos verificados**, coincidentes.

Esta compilación corresponde al perfil diagnóstico HRPAIR-1; no se afirma
haber compilado el perfil normal 1.0.22. Se cargó BIOSYS 1.0.22 HRPAIR-1 en
COM3 el 2026-09-28, con esptool 5.3.1: salida 0, verificación de hash de los
datos escritos y reinicio automático por RTS. Se coordinó BOOT/IO0 con el
usuario, sin pedirle pulsar RESET. 1.0.21 queda preservado como retorno.

### Comprobación posterior a la carga (no es prueba de FC)

- Registro: `measurements/biosys-1.0.22-hrpair/20260928-215629-post-carga-solo-comunicacion.log`
  y metadatos `.json` del mismo nombre, ignorados por Git.
- Intervalo: 21:56:29–21:56:39, UTC−03:00; 10 segundos solicitados,
  `completed=true`, 10 respuestas completas a `Q`, ninguna rechazada.
- Contacto: 0 en las 10 filas; FC instantánea y publicada sin valores VALID.
  MPU no disponible en las 10 filas, coherente con su desconexión declarada.
- El analizador informó 10 diferencias de estado: instantáneo `NO_CONTACT`
  (4), publicado `INSUFFICIENT_DATA` (1), ambos sin BPM. No se oculta esta
  diferencia ni se declara resuelta por la corrección de publicación.
- También informó 2 timestamps de muestra posteriores al `now_us` registrado
  (539 y 581 microsegundos). La causa no se ha investigado en esta carga;
  queda como observación pendiente, no como evidencia de mejora o de exactitud.
- Sin saltos de sondeo, reinicios de reloj, cambios de sesión, filas con
  muestras faltantes ni overflow FIFO reportados por este análisis.

La versión de la captura es una etiqueta del operador, respaldada aquí por
la carga verificada; HRPAIR esquema 1 no identifica por sí solo la versión.
La primera toma controlada con dedo se intentó después: solo produjo cuatro
registros completos y uno malformado, seguidos de falta de respuestas HRPAIR.
Ver [resultado y limitaciones](RESULTADOS_HRPAIR_DEDO_2026-09-28.md). Quedan
pendientes una captura íntegra y la observación de la TFT. No se declara
corregido el resultado físico, mejora de señal ni validación médica.

Las guías de diseño acotado, pruebas primero y verificación orientaron el
trabajo: se aplicó la aprobación existente, se reprodujeron fallos antes de
corregirlos y se mantuvo separada la evidencia de software de la física.
