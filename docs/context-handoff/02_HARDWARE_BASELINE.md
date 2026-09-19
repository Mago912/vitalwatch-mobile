# VITALWATCH — HARDWARE BASELINE

## Resumen

| Elemento | Modelo o tipo | Estado | Evidencia |
| --- | --- | --- | --- |
| Microcontrolador | ESP32 NodeMCU/Dev Module, 38 pines | `WORKING` | U |
| Pantalla | ST7735 1.44", 128×128 | `WORKING` | F, U |
| Sensor óptico | MAX30102 | `EXPERIMENTAL` | F, U |
| Sensor inercial | MPU60xx/65xx compatible | `EXPERIMENTAL` | F, U |
| Botones | 3 pulsadores a GND | `WORKING` | F, U |
| Batería/ADC | circuito no confirmado | `PENDING` | F |
| Control de backlight | LED directo a 3V3 | `PARTIALLY_WORKING` | F, U |

## ESP32

Objetivo de compilación de los scripts:

```text
FQBN: esp32:esp32:esp32
Monitor serie: 115200 baudios
```

El diseño usa ambos núcleos:

- `loop()` atiende sensores, botones y pantalla;
- una tarea FreeRTOS fijada al núcleo 0 realiza red/HTTPS.

No cambiar el modelo de placa o la configuración de memoria sin volver a medir
flash, RAM y comportamiento.

La fuente 0.9.1 entregada conserva este mismo FQBN, GPIO, buses y configuración
de hardware — F. Esto confirma continuidad de diseño, no funcionamiento físico.

## TFT ST7735

Configuración confirmada por código y pruebas anteriores:

| TFT | ESP32 | Nota |
| --- | --- | --- |
| LED | 3V3 | iluminación siempre alimentada |
| SCK | GPIO 18 | reloj SPI |
| SDA/MOSI | GPIO 23 | datos SPI |
| A0/DC | GPIO 2 | datos/comando |
| RESET | GPIO 4 | reset TFT |
| CS | GPIO 5 | selección TFT |
| GND | GND | masa común |
| VCC | 3V3 | no asumir tolerancia a 5 V |

Código de inicialización:

```cpp
tft.initR(INITR_144GREENTAB);
tft.setRotation(1);
```

Resolución lógica: 128×128. La UI usa una barra superior de 12 px, contenido y
footer. No asumir que otra variante de pestaña ST7735 tendrá los mismos colores
u offsets.

### Restricción de iluminación

`PIN_TFT_BACKLIGHT = -1`. El firmware puede dormir el controlador, pero si LED
está directo a 3V3 la luz sigue encendida. Para apagarla de verdad hace falta un
MOSFET o load switch correctamente diseñado. Nunca alimentar el LED completo
desde un GPIO.

## Bus I²C compartido

| Señal | ESP32 |
| --- | --- |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| Frecuencia | 100 kHz |
| Timeout | 100 ms |

El firmware incluye recuperación básica del bus y restablece reloj/timeout
después de iniciar el MAX30102.

## MAX30102

| Propiedad | Valor |
| --- | --- |
| Dirección I²C | `0x57` |
| Librería | SparkFun MAX3010x |
| Clase usada | `MAX30105` |
| Uso | PPG para BPM y SpO₂ |

La clase se llama `MAX30105`, pero la librería la usa también para MAX30102. No
interpretar el nombre de clase como un cambio de sensor.

El sensor fue detectado físicamente — `WORKING — U`. Los resultados BPM/SpO₂
siguen siendo `EXPERIMENTAL`; ver `06_BIOMEDICAL_STATUS.md`.

## IMU

El código no depende de una librería MPU externa. Lee registros I²C comunes y
acepta:

| Modelo | `WHO_AM_I` |
| --- | --- |
| MPU6050 | `0x68` |
| MPU6500 | `0x70` |
| MPU9250 | `0x71` |
| MPU9255 | `0x73` |

Direcciones buscadas: `0x68` y `0x69`.

`CONTEXT CONFLICT`: la solicitud original menciona MPU6050, pero la prueba
física previa reportó MPU6500 con `WHO_AM_I 0x70`. Para esta unidad, documentar
“MPU6500 detectado; firmware compatible con familia MPU60xx/65xx”. No forzar el
ID de MPU6050.

Rangos configurados:

- acelerómetro: ±8 g;
- giroscopio: ±500 °/s;
- objetivo de muestreo: 100 Hz.

## Botones

Cableado vigente con `INPUT_PULLUP`:

| Acción | GPIO | Conexión al pulsar |
| --- | --- | --- |
| Izquierda | 25 | GND |
| OK | 26 | GND |
| Derecha | 27 | GND |

No conectar 3V3 al otro lado del pulsador en este diseño.

Temporizaciones:

- antirrebote: 35 ms;
- OK largo: 1.2 s;
- SOS izquierda + derecha: 2.5 s.

Comportamientos:

- izquierda/derecha navegan;
- OK corto elige o vuelve;
- OK largo en Medicación marca tomado;
- OK largo en otras vistas reinicia diagnóstico de sensores;
- mantener OK durante el arranque borra solo las credenciales WiFi guardadas;
- izquierda + derecha activa SOS.

## WiFi

El ESP32 clásico solo soporta 2.4 GHz. El portal crea una red temporal con un
nombre derivado de `DEVICE_CODE`, normalmente `VitalWatch-VW-001`, y sirve el
formulario en `192.168.4.1`.

La red doméstica queda guardada en NVS. No se envía a Supabase. Las credenciales
compiladas son solo una vía de migración/respaldo.

La clave común del portal está visible en el firmware/documentación del
prototipo; es una limitación de seguridad y no debe reutilizarse en un producto.

## Alimentación y batería

Hechos confirmados:

- TFT y sensores comparten GND con el ESP32.
- La TFT documentada usa 3V3.
- No existe en el repositorio un circuito real de batería confirmado.
- `PIN_BATERIA_ADC = -1` desactiva la medición.
- El firmware envía batería nula cuando no hay lectura válida.

La API está preparada para un divisor resistivo, con referencias 3.30 V vacía y
4.20 V llena y factor 2.0, pero esos valores son una preparación de software,
no prueba del hardware.

## DO NOT ASSUME

- No asumir MPU6050 si el chip reporta otro ID compatible.
- No asumir que una TFT similar usa la misma pestaña de inicialización.
- No asumir que 5 V es seguro para TFT o sensores.
- No asumir batería solo porque la app muestra un porcentaje simulado o previo.
- No conectar una LiPo directamente a un ADC/GPIO.
- No cambiar GPIO porque “parecen libres” sin revisar arranque, SPI, I²C y placa.
- No golpear la placa para probar caídas.
