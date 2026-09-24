# Manifiesto tecnico - BIOSYS 1.0.11 candidato

## Identidad

| Capa | Versión | Cambio de esta entrega |
|---|---:|---|
| Producto | BIOSYS 1.0.11 | filtro de picos aislados antes de una posible caida |
| Sistema | SYS 0.9.9 | pulsación corta y bloqueo antirepetición |
| Biomédica | BIO 0.6.5 | movimiento previo y evidencia combinada de impacto |
| App compatible | 1.0.12 | Contactos, detalle, llamadas y push privado |

Punto de partida verificable: `VitalWatch_BIOSYS_1_0_1_Arduino.zip`, SHA-256
`BA0F305B535CF4FE2CEDBF103ACB312753D640BB73C41F48C09C9AC481CA97C5`.
Sus 26 entradas coincidían byte por byte con la carpeta 1.0.1 antes de crear
esta revisión. El archivo privado `vitalwatch_config.h` no forma parte del ZIP.

Todavia no se genero un paquete publico para esta revision.

## Hardware y dependencias preservados

- ESP32 clásico, FQBN `esp32:esp32:esp32`.
- TFT ST7735 1,44 pulgadas, 128x128.
- MAX30102 I2C `0x57` y familia MPU `0x68/0x69`.
- GPIO, buses, 100 kHz I2C y timeout 100 ms sin cambios.
- Core ESP32 3.3.11, SparkFun MAX3010x 1.1.2, ArduinoJson 7.4.3,
  Adafruit GFX 1.12.6 y Adafruit ST7735/ST7789 1.11.0.
- MAX30102 normal: LED inicial 0x50, promedio 4, rojo+IR, 100 Hz, pulso 411 us
  y rango 4096; el FIFO entrega ~25 registros/s.
- El modo de investigacion prueba menor potencia LED; no pasa al producto sin
  comparacion externa de referencia.
- Umbrales HR/SpO2 sin retuning; el impacto ahora exige movimiento previo o
  aceleracion y giro extremos simultaneos.
- Botones: GPIO25 izquierda, GPIO26 OK, GPIO27 derecha y GPIO14 SOS, todos con
  `INPUT_PULLUP` hacia GND.

## Compilación reproducible

| Perfil | Flash usada | RAM global | Estado |
|---|---:|---:|---|
| Producto | 1.179.600 B (89 %) | 55.064 B (16 %) | PASS |
| Investigacion | 1.182.028 B (90 %) | 59.000 B (18 %) | PASS |

## Estado de validación

- Compilacion producto e investigacion: `PASS`.
- App ESLint: `PASS`; pruebas de lecturas 7/7 y medicacion 5/5.
- Carga normal al ESP32 de 1.0.11: `PASS` por COM3 a 115200, con verificacion
  de hash y reinicio.
- Arranque fisico: `VW-BIOSYS 1.0.11`, `VW-SYS 0.9.9`, `VW-BIO 0.6.5`.
- I2C: MAX30102 `0x57`, `PART_ID=0x15`; MPU6500 `0x68`, `WHO_AM_I=0x70`.
- El primer sondeo del MPU puede dar timeout y el reintento posterior lo inicia.
- MAX30102: prueba de investigacion a 24,96 Hz con cero muestras perdidas.
- MPU6500: giro residual quieto `0,00092 rad/s`; cero saturaciones.
- Golpes suaves de mesa de 1.0.10: maximo `1,33 g`, sin cumplir impacto
  combinado. El nuevo armado de 1.0.11 requiere validacion fisica.
- Reposo de 1.0.11: 90 segundos sin `POSSIBLE_IMPACT`, pico aislado ni caida.
- Movimientos realizados durante la carga llegaron a `1,2-4,3 rad/s` y si
  armaron el detector; falta una prueba controlada de movimientos cotidianos.
- Exactitud clinica de HR y SpO2: no validada por falta de referencia externa.
- Navegación física: pendiente de validación completa.
- Validación clínica: no realizada.

## Archivos privados y generados

`vitalwatch_config.h`, `build/`, `.bin`, `.elf` y `.map` no son fuente pública.
El ZIP de Arduino debe contener `vitalwatch_config.example.h`, nunca el archivo
privado ni directorios de compilación.
