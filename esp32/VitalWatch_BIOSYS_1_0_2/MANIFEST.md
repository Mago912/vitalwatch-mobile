# Manifiesto técnico — BIOSYS 1.0.2

## Identidad

| Capa | Versión | Cambio de esta entrega |
|---|---:|---|
| Producto | BIOSYS 1.0.2 | integración, UI y empaquetado |
| Sistema | SYS 0.9.3 | órdenes de vista de una sola ejecución y reporte local |
| Biomédica | BIO 0.6.1 | autoganancia precontacto y diagnóstico PPG visible |
| App compatible | 1.0.4 build 9 | sin cambios de código ni APK |

Punto de partida verificable: `VitalWatch_BIOSYS_1_0_1_Arduino.zip`, SHA-256
`BA0F305B535CF4FE2CEDBF103ACB312753D640BB73C41F48C09C9AC481CA97C5`.
Sus 26 entradas coincidían byte por byte con la carpeta 1.0.1 antes de crear
esta revisión. El archivo privado `vitalwatch_config.h` no forma parte del ZIP.

Paquete público generado: `docs/VitalWatch_BIOSYS_1_0_2_Arduino.zip` (26
entradas, 68.930 B), SHA-256
`F1B62840799F12ABD60757E6CBDF8EC2F3FAC7FE0E9578694320CBCA0DB40606`.

## Hardware y dependencias preservados

- ESP32 clásico, FQBN `esp32:esp32:esp32`.
- TFT ST7735 1,44 pulgadas, 128x128.
- MAX30102 I2C `0x57` y familia MPU `0x68/0x69`.
- GPIO, buses, 100 kHz I2C y timeout 100 ms sin cambios.
- Core ESP32 3.3.11, SparkFun MAX3010x 1.1.2, ArduinoJson 7.4.3,
  Adafruit GFX 1.12.6 y Adafruit ST7735/ST7789 1.11.0.
- MAX30102: LED 0x70, promedio 4, rojo+IR, 400 Hz, pulso 411 us y rango 4096.
- Umbrales biomédicos, filtros, ventanas HR/SpO2 e impacto sin retuning.

## Compilación reproducible

| Perfil | Flash | RAM global | SHA-256 del `.bin` |
|---|---:|---:|---|
| Producto | 1.162.256 B | 53.920 B | `B0383A63943564A136C8B217015896EA3330984428814FBA0E03B3A3A79CC2C7` |
| Investigación | 1.164.148 B | 57.712 B | `DADA7561BB1D95ED9322345325DBC3A609817D8911763D873FC638D2C778F189` |

## Estado de validación

- Compilación producto: `PASS`.
- Compilación investigación: `PASS`.
- App/TypeScript/ESLint: sin cambios de runtime; comprobación de repositorio
  indicada en el informe raíz.
- Carga al ESP32: PASS en COM3; verificación de hash completada.
- MAX30102: detección y prueba PPG inicial realizadas; repetir con presión suave.
- Navegación física: pendiente de validación completa.
- Validación clínica: no realizada.

## Archivos privados y generados

`vitalwatch_config.h`, `build/`, `.bin`, `.elf` y `.map` no son fuente pública.
El ZIP de Arduino debe contener `vitalwatch_config.example.h`, nunca el archivo
privado ni directorios de compilación.
