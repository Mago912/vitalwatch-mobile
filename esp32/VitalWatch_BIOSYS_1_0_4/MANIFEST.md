# Manifiesto técnico — BIOSYS 1.0.4

## Identidad

| Capa | Versión | Cambio de esta entrega |
|---|---:|---|
| Producto | BIOSYS 1.0.4 | salida PPG robusta y publicación cada 5 s |
| Sistema | SYS 0.9.4 | telemetría alineada con la cadencia visual |
| Biomédica | BIO 0.6.3 | mediana temporal de HR y retención de resultados |
| App compatible | 1.0.4 build 9 | contrato compatible; fuente visual preparada |

Punto de partida verificable: `VitalWatch_BIOSYS_1_0_1_Arduino.zip`, SHA-256
`BA0F305B535CF4FE2CEDBF103ACB312753D640BB73C41F48C09C9AC481CA97C5`.
Sus 26 entradas coincidían byte por byte con la carpeta 1.0.1 antes de crear
esta revisión. El archivo privado `vitalwatch_config.h` no forma parte del ZIP.

Paquete público de esta revisión: `docs/VitalWatch_BIOSYS_1_0_4_Arduino.zip`
(26 entradas). El hash del paquete se registra en el informe raíz para evitar
que el propio archivo contenga una suma que cambie al documentarla.

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

## Compilación reproducible

| Perfil | Tamaño `.bin` | RAM global | SHA-256 del `.bin` |
|---|---:|---:|---|
| Producto | 1.163.536 B | 54.024 B | `B394C15D321C3609ED72D78242E295ADC22E751FA125E3BC4C4640769381B474` |
| Investigación | 1.165.392 B | 57.816 B | `7CEA35F3F26428AF8E884F36FF9D82E3235E30254E86577C789BB081981B53A6` |

## Estado de validación

- Compilación producto: `PASS`; 1.163.384 B flash, 54.024 B RAM.
- Compilación investigación: `PASS`; binario generado el 2026-09-13.
- App/TypeScript/ESLint: `PASS` (`npm run lint`).
- Carga al ESP32: no realizada en esta revisión, por solicitud del usuario.
- MAX30102: la base 1.0.3 fue probada; esta salida de 5 s requiere una prueba
  física posterior para confirmar la estabilidad sostenida de HR.
- Navegación física: pendiente de validación completa.
- Validación clínica: no realizada.

## Archivos privados y generados

`vitalwatch_config.h`, `build/`, `.bin`, `.elf` y `.map` no son fuente pública.
El ZIP de Arduino debe contener `vitalwatch_config.example.h`, nunca el archivo
privado ni directorios de compilación.
