# Dependencias del baseline BIOSYS 1.0.8

## Toolchain

| Componente | Versión | Inclusión en el ZIP |
|---|---:|---|
| Arduino CLI | 1.5.1 | instalador reproducible; ejecutable no incluido |
| ESP32 Arduino Core | 3.3.11 | versión documentada; core no incluido por tamaño |
| FQBN | `esp32:esp32:esp32` | documentado |

## Bibliotecas directas

| Biblioteca | Versión | Uso principal |
|---|---:|---|
| ArduinoJson | 7.4.3 | JSON de medicación y mensajería |
| Adafruit GFX Library | 1.12.6 | primitivas gráficas |
| Adafruit ST7735 and ST7789 Library | 1.11.0 | controlador TFT |
| SparkFun MAX3010x Pulse and Proximity Sensor Library | 1.1.2 | MAX30102, HR y SpO2 |

## Bibliotecas transitivas instaladas

| Biblioteca | Versión | Origen |
|---|---:|---|
| Adafruit BusIO | 1.17.4 | dependencia de Adafruit GFX |
| Adafruit seesaw Library | 1.7.9 | dependencia declarada por la librería TFT |
| SD | 1.3.0 | dependencia declarada por la librería TFT |

## APIs provistas por el core ESP32/Arduino

`Arduino`, `Wire`, `SPI`, `WiFi`, `HTTPClient`, `WiFiClientSecure`,
`Preferences`, `DNSServer`, `WebServer`, FreeRTOS y `time` se resuelven mediante
ESP32 Arduino Core 3.3.11; no son bibliotecas externas separadas de este
baseline.

La copia de cada biblioteca conserva sus archivos de licencia y documentación
originales tal como estaban instalados localmente.
