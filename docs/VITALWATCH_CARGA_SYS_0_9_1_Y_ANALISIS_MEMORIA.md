# VitalWatch — carga de VW-SYS 0.9.1 y análisis de memoria

Fecha de verificación: 2026-09-01.

## Resultado ejecutivo

- Se compiló y cargó `VW-SYS 0.9.1` en el ESP32 conectado por USB.
- La escritura llegó al 100 %, `esptool` verificó los hashes de los bloques y
  reinició la placa.
- El arranque posterior confirmó por Serial:
  - botones en GPIO 25/26/27;
  - IMU MPU6500 detectada en `0x68`, `WHO_AM_I=0x70`;
  - MAX30102 detectado, `PART_ID=0x15`;
  - firmware `VitalWatch VW-SYS 0.9.1` listo;
  - WiFi conectado, telemetría enviada, dos medicamentos sincronizados y vista
    remota `medication` recibida.
- La app está identificada como `1.0.3`; el apartado **Pulsera** y su TFT
  virtual están presentes, y pasan ESLint y TypeScript.
- No se cargó `VW-BIO 0.6.0`, para no sustituir el sistema que necesita la app.

## SYS y BIO no son dos capas instalables simultáneamente

`VW-SYS 0.9.1` y `VW-BIO 0.6.0` son sketches completos alternativos. Al cargar
uno, se sustituye la aplicación ESP32 anterior en la partición activa.

| Perfil | Uso | App móvil | WiFi/Supabase | Sensores |
|---|---|---:|---:|---:|
| `VW-SYS 0.9.1` | Prueba integral | Sí | Sí | Sí |
| `VW-BIO 0.6.0` | Ensayo biomédico aislado | No | No | Sí |

Por tanto, el orden práctico es:

1. Probar ahora la app 1.0.3 con `VW-SYS 0.9.1`.
2. Cuando se cierre esa prueba, cargar manualmente el perfil BIO requerido.
3. Al terminar el laboratorio, volver a cargar SYS para recuperar la conexión
   con la app.

## Carga manual de BIO y uso de IO0/BOOT

Comandos disponibles desde la raíz del proyecto:

```powershell
npm run firmware:ports
npm run firmware:bio:upload
npm run firmware:bio:research:upload
npm run firmware:bio:replay:upload
```

- `firmware:bio:upload`: perfil normal de sensores y TFT.
- `firmware:bio:research:upload`: añade captura CSV no bloqueante.
- `firmware:bio:replay:upload`: añade captura y reproducción CSV por Serial.

Procedimiento con el botón rotulado `BOOT`, `IO0` o `0`:

1. Conectar el ESP32 por USB y cerrar cualquier monitor Serial que tenga el
   puerto ocupado.
2. Ejecutar uno de los comandos anteriores.
3. Normalmente no hay que tocar ningún botón. Si aparece `Wrong boot mode` o el
   proceso queda en `Connecting...`, mantener pulsado **IO0/BOOT** y repetir el
   comando.
4. Soltar **IO0/BOOT** en cuanto se lea `Connected to ESP32` o empiece
   `Writing at...`.
5. Si aún no entra al cargador: mantener IO0, pulsar y soltar una vez `EN/RST`,
   esperar la conexión y entonces soltar IO0.

No se debe mantener IO0 durante el uso normal. Para restaurar el sistema:

```powershell
npm run firmware:upload
```

## Medición real de flash y RAM estática

Las cifras proceden de la salida de Arduino CLI 1.4.1 y de los ELF/MAP creados
con Arduino-ESP32 3.3.11 para `esp32:esp32:esp32`.

| Build | Flash de app | Máximo de app | Ocupación | RAM global | Ocupación RAM |
|---|---:|---:|---:|---:|---:|
| SYS 0.9.1 | 1.158.620 B | 1.310.720 B | 88 % | 53.536 B | 16 % |
| BIO 0.6.0 normal | 351.384 B | 1.310.720 B | 26 % | 26.260 B | 8 % |
| BIO research | 353.232 B | 1.310.720 B | 26 % | 30.052 B | 9 % |
| BIO research + replay | 370.476 B | 1.310.720 B | 28 % | 30.180 B | 9 % |

SYS conserva 152.100 bytes dentro de su partición de aplicación. El `88 %` no
significa que se haya ocupado el 88 % de toda la flash física de 4 MiB. La tabla
de particiones actual reserva dos aplicaciones OTA de `0x140000` bytes cada una,
además de NVS, SPIFFS y coredump:

```text
app0  0x140000 = 1.310.720 bytes
app1  0x140000 = 1.310.720 bytes
```

La documentación de Espressif confirma que el esquema de particiones distribuye
la flash entre almacenamiento y OTA. Un esquema `Huge APP` aumentaría el límite
de la aplicación, pero eliminaría OTA y **no reduciría el firmware**. No se ha
cambiado el particionado. Referencias: [menú y esquemas de Arduino-ESP32](https://docs.espressif.com/projects/arduino-esp32/en/latest/guides/tools_menu.html),
[tablas personalizadas](https://docs.espressif.com/projects/arduino-esp32/en/latest/tutorials/partition_table.html)
y [funcionamiento de OTA](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/ota.html).

## Distribución del peso

### SYS 0.9.1

Suma aproximada por componente de secciones enlazadas (`text`, `rodata`, IRAM y
DRAM) en el MAP:

| Componente | Bytes atribuidos | Motivo |
|---|---:|---|
| `libnet80211` | 170.472 | radio WiFi 802.11 |
| sketch VitalWatch | 155.017 | lógica, cadenas, JSON y gráficos propios |
| `lwIP` | 135.106 | TCP/IP, DHCP y DNS |
| `mbedcrypto` | 110.920 | criptografía de HTTPS |
| `wpa_supplicant` | 60.827 | seguridad WiFi |
| `libpp` | 57.785 | capa WiFi del ESP32 |
| C library | 51.574 | formato, fechas y utilidades |
| `mbedtls_2` | 40.488 | protocolo TLS |
| Arduino core | 33.905 | runtime Arduino |
| `WebServer` | 18.812 | portal de configuración WiFi |
| `HTTPClient` | 11.980 | solicitudes a Supabase |
| `NetworkClientSecure` | 4.452 | integración del socket TLS |

Las cifras son atribuciones de secciones, no deben sumarse directamente para
reconstruir el tamaño del `.bin` porque existen alineaciones y secciones con
reglas distintas. Sí muestran con claridad qué subsistemas dominan.

Conclusión: el tamaño alto de SYS no viene principalmente de HR, SpO2 o IMU. Es
el coste de WiFi + TCP/IP + WPA + HTTPS + portal cautivo. Quitar TLS rompería
Supabase y no es aceptable; `setInsecure()` omite la validación del certificado,
pero no elimina la criptografía TLS.

### BIO 0.6.0

BIO no contiene la pila de red y queda en 26 %. Sus principales grupos son:

| Componente | Bytes atribuidos |
|---|---:|
| sketch BIO, datos y gráficos | 77.037 |
| C library | 35.273 |
| Arduino core | 27.239 |
| FreeRTOS | 19.635 |
| driver UART | 15.417 |
| flash/core ESP | 13.739 |
| driver I2C | 12.959 |
| Adafruit GFX | 7.328 |
| SparkFun MAX3010x | 3.290 |

No hay presión de flash ni RAM estática en BIO. Aquí conviene optimizar para
limpieza y repetibilidad, no sacrificar trazabilidad biomédica por unos bytes.

## Hallazgos concretos y experimentos

### 1. Dos bitmaps RGB565 completos

SYS y BIO guardan dos corazones de 86 × 62 píxeles:

```text
5.332 píxeles × 2 bytes × 2 variantes = 21.328 bytes
```

Se compiló un experimento aislado que reutiliza un solo bitmap:

| Build | Original | Experimental | Ahorro medido |
|---|---:|---:|---:|
| SYS | 1.158.620 B | 1.147.944 B | 10.676 B |
| BIO normal | 351.384 B | 340.724 B | 10.660 B |

No se aplicó al código de producción porque cambia el aspecto tenue del menú.
Una alternativa mejor es RLE: el análisis de las carreras de color dio 3.912 B
para el logo normal y 3.160 B para el tenue, 7.072 B en total antes del pequeño
decodificador. El ahorro teórico sería de unos 14.256 B conservando ambas
apariencias. Debe medirse además el tiempo de dibujo antes de integrarlo.

### 2. `sscanf` en el replay de BIO

El lector CSV de replay usa `sscanf`. Ese único uso incorpora el analizador
genérico `__ssvfscanf_r` y dependencias. Se compiló un parser experimental con
validación explícita de cinco enteros, delimitadores, overflow y `timing` 0/1:

| Replay | Flash | Diferencia |
|---|---:|---:|
| actual | 370.476 B | — |
| parser manual experimental | 352.688 B | −17.788 B |

Es una optimización de bajo riesgo para el perfil de laboratorio, pero antes de
integrarla requiere pruebas con filas válidas, límites, overflow, campos vacíos
y texto corrupto. No afecta al build BIO normal porque replay se compila sólo
cuando se habilita.

### 3. Formato numérico genérico

En ambos ELF aparecen `_svfprintf_r` (11.305 B), `_vfprintf_r` (11.520 B) y
`_dtoa_r` (3.289 B): 26.114 B de símbolos grandes, además de sus tablas. Se
activan por `snprintf`, `Serial.printf`, `tft.printf` y formatos de coma flotante.

No se recomienda reemplazarlos sin una compilación comparativa. Parte de la
biblioteca de red y del core también usa formatos. En BIO se puede experimentar
con impresión entera/fija para la interfaz y dejar los `float` sólo en los
cálculos. Cambiar la representación matemática de sensores sin dataset no está
autorizado por este análisis.

### 4. `sscanf` indirecto en SYS

SYS incluye `__ssvfiscanf_r` (7.600 B), pero no por una llamada del código
VitalWatch. El MAP demuestra la cadena:

```text
HTTPClient -> strptime/mktime -> tzset -> siscanf -> __ssvfiscanf_r
```

Eliminarlo exige sustituir o modificar `HTTPClient`; no es una optimización
aislada segura.

### 5. Configuración del compilador

La compilación ya usa `-Os`, `-ffunction-sections`, `-fdata-sections` y el linker
usa `--gc-sections`. Es decir, ya se optimiza por tamaño y se descarta código no
referenciado. El core precompilado actual enlaza con `-fno-lto` y compila C++ con
excepciones; activar LTO o cambiar excepciones no es un simple flag local seguro.
Requeriría un core/ESP-IDF recompilado y una campaña completa de regresión.

Espressif recomienda precisamente medir primero, usar `-Os`, considerar LTO y
desactivar características concretas sólo cuando no se necesitan:
[Minimizing Binary Size](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/performance/size.html).

## RAM: lo estático no cuenta toda la historia

Los 53.536 B de SYS son sólo `.data` + `.bss`. WiFi, TLS, `String`,
`JsonDocument`, las colas y las pilas de tareas consumen heap en ejecución. La
tarea de red reserva actualmente una pila de 16.384 bytes. No debe reducirse a
ciegas porque TLS y JSON pueden alcanzar picos.

Antes de modificar RAM se debe añadir un diagnóstico temporal y probar:

- arranque y conexión WiFi;
- apertura del portal;
- sincronización y marcado de medicación;
- envío de telemetría normal, caída y SOS;
- pérdida y recuperación de red;
- navegación y medición simultánea de sensores.

Métricas necesarias:

```cpp
heap_caps_get_free_size(MALLOC_CAP_8BIT)
heap_caps_get_minimum_free_size(MALLOC_CAP_8BIT)
heap_caps_get_largest_free_block(MALLOC_CAP_8BIT)
uxTaskGetStackHighWaterMark(tareaMedicacion)
```

El bloque libre más grande permite detectar fragmentación aunque el total libre
parezca suficiente. En ESP32, el high-water mark de la pila se expresa en bytes.
Referencias oficiales: [uso de RAM](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-guides/performance/ram-usage.html)
y [API de heap](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/api-reference/system/mem_alloc.html).

## Plan recomendado

1. Terminar primero la prueba funcional app 1.0.3 + SYS 0.9.1 actualmente
   instalado. No cambiar el binario durante esa validación.
2. Crear un build diagnóstico SYS que registre heap mínimo, bloque máximo y
   margen de pila de la tarea de red. Ejecutar todos los escenarios anteriores.
3. Integrar y probar el parser manual de replay BIO: ahorro medido de 17.788 B.
4. Prototipar RLE para los dos logos y medir flash y tiempo de renderizado. Meta:
   alrededor de 14 KB sin perder la variante tenue.
5. Comparar en una rama experimental la eliminación de formatos `float` en UI y
   logs, sin tocar cálculos biomédicos.
6. Mantener WebServer, HTTPS y la partición OTA mientras sean requisitos. Sólo
   crear un perfil SYS sin portal o sin OTA si el producto define explícitamente
   cómo se configurará y actualizará en su lugar.

## Criterio de aceptación de una optimización

Cada cambio deberá entregar al menos:

- tamaño antes/después de flash, `.data` y `.bss`;
- heap mínimo y bloque libre máximo durante una prueba completa;
- high-water mark de cada tarea propia;
- compilación normal y de perfiles de laboratorio;
- prueba física de TFT, botones, MAX30102, IMU, WiFi y app;
- para BIO, comparación con el mismo dataset y sin modificar umbrales o
  resultados biomédicos sin autorización del laboratorio.

