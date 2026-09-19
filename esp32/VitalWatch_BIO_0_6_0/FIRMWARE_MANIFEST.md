# Manifest — VitalWatch VW-BIO 0.6.0

| Campo | Valor |
|---|---|
| Familia | `VW-BIO` |
| Version | `0.6.0` |
| Rol | `BIOMEDICAL_VALIDATION_PROFILE` |
| Baseline | `FW 0.5.0` |
| Sistema objetivo | `VW-SYS 0.9.1` (separado, no integrado) |
| MCU/FQBN | ESP32 Dev Module / `esp32:esp32:esp32` |
| ESP32 Arduino core probado | `3.3.11` |
| Display | ST7735 1.44 pulgadas, 128x128 |
| PPG | MAX30102, SparkFun MAX3010x 1.1.2 |
| IMU objetivo validable | MPU6050; otras IDs se marcan unvalidated |
| Estado software | compila normal y research/replay |
| Estado hardware | `HARDWARE_VALIDATION_REQUIRED` |

## Contratos preservados

- I2C: SDA 21, SCL 22, 100 kHz, timeout 100 ms.
- TFT: CS 5, DC 2, RST 4, MOSI 23, SCLK 18.
- Botones: GPIO 25/26/27 con `INPUT_PULLUP`.
- MAX30102: LED inicial `0x70`, AVG4, RED+IR, 400 sps, 411 us,
  ADC 4096.
- MPU: +/-8 g, +/-500 dps, objetivo aproximado 100 Hz, DLPF 4.
- Impacto: umbrales heredados y salida semantica `POSSIBLE_IMPACT`.

## Librerias conservadas

- Wire y SPI del core ESP32.
- Adafruit GFX.
- Adafruit ST7735/ST7789.
- SparkFun MAX3010x, `heartRate.h` y `spo2_algorithm.h`.

No se migro de driver, no se cambio la tasa de muestreo, no se ajustaron
umbrales clínicos y no se agregaron dependencias.
