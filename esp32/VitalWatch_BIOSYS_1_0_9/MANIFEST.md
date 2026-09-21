# Manifiesto tecnico - BIOSYS 1.0.9

## Identidad

| Capa | Versión | Cambio de esta entrega |
|---|---:|---|
| Producto | BIOSYS 1.0.9 | botón SOS físico en GPIO14 |
| Sistema | SYS 0.9.9 | pulsación corta y bloqueo antirepetición |
| Biomédica | BIO 0.6.3 | mediana temporal de HR y retención de resultados |
| App compatible | 1.0.10 | Contactos, detalle, llamadas y push privado |

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
- MAX30102: LED inicial 0x50, promedio 4, rojo+IR, 100 Hz, pulso 411 us y
  rango 4096; el FIFO entrega ~25 registros/s.
- Umbrales biomédicos, filtros, ventanas HR/SpO2 e impacto sin retuning.
- Botones: GPIO25 izquierda, GPIO26 OK, GPIO27 derecha y GPIO14 SOS, todos con
  `INPUT_PULLUP` hacia GND.

## Compilación reproducible

| Perfil | Tamaño `.bin` | RAM global | SHA-256 del `.bin` |
|---|---:|---:|---|
| Producto | 1.179.040 B | 54.704 B | `1E0DB33BC408C5C2A0874682964C38614DF6838F2414B804C8BDB71DFCF5F605` |
| Investigacion | pendiente | pendiente | pendiente |

## Estado de validación

- Compilacion producto: `PASS`; 1.178.888 B de flash usada (89 %) y
  54.704 B de RAM global (16 %).
- Compilacion investigacion: pendiente.
- App/TypeScript/ESLint: `PASS`.
- Carga al ESP32: `PASS` por COM3, con verificación de hash y reinicio RTS.
- Compilación física de esta revisión: `PASS`; la carga todavía debe realizarse
  antes de declarar BIOSYS 1.0.9 validado.
- Escaneo I2C: solamente `0x57`; `0x68/0x69` dieron NACK, SDA/SCL en HIGH.
- MAX30102: `PASS`, `PART_ID=0x15`; IMU no respondió en ninguna dirección.
- MAX30102: la base 1.0.3 fue probada; esta salida de 5 s requiere una prueba
  física posterior para confirmar la estabilidad sostenida de HR.
- Navegación física: pendiente de validación completa.
- Validación clínica: no realizada.

## Archivos privados y generados

`vitalwatch_config.h`, `build/`, `.bin`, `.elf` y `.map` no son fuente pública.
El ZIP de Arduino debe contener `vitalwatch_config.example.h`, nunca el archivo
privado ni directorios de compilación.
