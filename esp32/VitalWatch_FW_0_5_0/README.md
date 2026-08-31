# VitalWatch FW 0.5.0 - base recibida

Esta carpeta conserva sin cambios el firmware entregado el 26 de agosto de
2026. Se usa como referencia estable antes de integrar la aplicacion movil y
Supabase.

## Archivos de origen

- `VitalWatch_FW_0_5_0_Arduino.zip`
  - SHA-256: `9B72FE4BCEEECD3D2B72B9F5A201B77E8DE9821D8FF60862684F75474A708466`
- `libraries.rar`
  - SHA-256: `53D52F65EA034E95293838F6F92AA5B5EC886EB98D57754ACE57A6D2A74739DC`

## Dependencias utilizadas

- ESP32 Arduino Core `3.3.11`.
- Adafruit GFX Library `1.12.6`.
- Adafruit ST7735 and ST7789 Library `1.11.0`.
- Adafruit BusIO `1.17.4`.
- SparkFun MAX3010x Pulse and Proximity Sensor Library `1.1.2`.

El archivo de bibliotecas recibido tambien contiene MPU6050, SSD1306, TFT_eSPI,
Keypad y otras dependencias, pero el firmware 0.5.0 no las incluye. El MPU se
maneja directamente por registros I2C, por lo que no necesita una biblioteca
externa.

## Hardware definido por esta base

- TFT ST7735: `CS 5`, `DC 2`, `RST 4`, `MOSI 23`, `SCLK 18`.
- I2C compartido: `SDA 21`, `SCL 22`.
- Botones: izquierda `GPIO25`, OK `GPIO26`, derecha `GPIO27`.
- MAX30102: direccion I2C `0x57`.
- MPU compatible: direccion I2C `0x68` o `0x69`.

No se agregan cambios directamente en esta carpeta. La siguiente version del
firmware parte de esta base e incorpora la sincronizacion con Supabase.
