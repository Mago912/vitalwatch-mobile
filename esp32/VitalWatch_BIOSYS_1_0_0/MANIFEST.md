# Manifiesto técnico — BIOSYS 1.0.0

## Identidad versionada

| Capa | Versión | Responsabilidad |
|---|---:|---|
| Producto integrado | BIOSYS 1.0.0 | Contrato común, arranque, presentación y empaquetado |
| Sistema | SYS 0.9.1 | TFT, botones, SOS, WiFi, medicación, control remoto y telemetría |
| Biomédica | BIO 0.6.0 | PPG/MAX30102, HR, SpO2 experimental, IMU y posible impacto |
| App | 1.0.3 | Apartado Pulsera y réplica virtual del estado del dispositivo |

La versión de producto puede avanzar sin ocultar las versiones de sus componentes. La pantalla Estado y la app muestran las tres identidades.

## Hardware objetivo

- ESP32 clásico, FQBN de compilación: `esp32:esp32:esp32`.
- TFT ST7735 1,44 pulgadas.
- MAX30102 en I²C `0x57`.
- Familia MPU en `0x68` o `0x69`; identifica 6050/6500/9250/9255.
- Tres botones con `INPUT_PULLUP` en GPIO 25, 26 y 27.
- Bus I²C compartido en los pines declarados en `Configuracion.h`.

## Dependencias Arduino

- Core ESP32 y bibliotecas de red incluidas por el core.
- Adafruit GFX y Adafruit ST7735.
- SparkFun MAX3010x.
- ArduinoJson.
- Algoritmo MAX3010x `spo2_algorithm.h`.

## Resultado reproducible de compilación

Compilación normal ejecutada con `npm run firmware:biosys:build`:

| Recurso | BIOSYS 1.0.0 | Límite reportado | Uso |
|---|---:|---:|---:|
| Flash del sketch | 1.160.196 B | 1.310.720 B | 88 % |
| RAM global/estática | 53.872 B | 327.680 B | 16 % |
| RAM disponible para variables locales | 273.808 B | — | — |

Comparado con SYS 0.9.1 compilado previamente, BIOSYS agrega 1.576 B de flash y 336 B de RAM estática. BIO 0.6.0 no se incrusta como un segundo programa: sus servicios reemplazan los sensores anteriores de SYS.

El perfil de investigación también compila: 1.162.112 B de flash (88 %) y 57.664 B de RAM estática (17 %).

## Perfiles

| Perfil | Macro | Uso |
|---|---|---|
| Producto | `BIO_RESEARCH_MODE=0` | Funcionamiento normal |
| Investigación | `BIO_RESEARCH_MODE=1` | CSV diagnóstico por Serial |
| Replay | No integrado en BIOSYS 1.0.0 | Permanece en el proyecto BIO independiente |

## Estado de aceptación

- `COMPILE_PASS`: sí.
- `APP_STATIC_CHECKS`: consultar el informe final de integración.
- `HARDWARE_FLASHED`: no en esta entrega.
- `HARDWARE_VALIDATION_REQUIRED`: sí.
- `CLINICAL_VALIDATION`: no.

Los valores HR y SpO2 se ocultan como `--` si no tienen estado válido. SpO2 se rotula experimental por diseño.
