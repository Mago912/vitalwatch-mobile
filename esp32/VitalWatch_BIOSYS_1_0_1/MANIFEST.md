# Manifiesto técnico — BIOSYS 1.0.1

## Identidad versionada

| Capa | Versión | Responsabilidad |
|---|---:|---|
| Producto integrado | BIOSYS 1.0.1 | Contrato común, arranque, presentación y empaquetado |
| Sistema | SYS 0.9.2 | TFT, botones, SOS, WiFi, medicación, control remoto y telemetría |
| Biomédica | BIO 0.6.0 | PPG/MAX30102, HR, SpO2 experimental, IMU y posible impacto |
| App | 1.0.4 | Apartado Pulsera, réplica virtual y OK remoto confirmado |

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

| Recurso | BIOSYS 1.0.1 | Límite reportado | Uso |
|---|---:|---:|---:|
| Flash del sketch | 1.160.984 B | 1.310.720 B | 88 % |
| RAM global/estática | 53.872 B | 327.680 B | 16 % |
| RAM disponible para variables locales | 273.808 B | — | — |

BIOSYS 1.0.1 conserva la misma capa BIO 0.6.0 y agrega al SYS el contrato de OK remoto y estado de alerta reportado. BIO no se incrusta como segundo programa: sus servicios reemplazan los sensores anteriores de SYS.

El perfil de investigación también compila: 1.162.900 B de flash (88 %) y 57.664 B de RAM estática (17 %).

Binario de producto `VitalWatch_BIOSYS_1_0_1.ino.bin`:
SHA-256 `6E34BB18C25D8C6A8635E741D97DBD6F5C1E368D96CEE392C2003069FDF46B8A`.

## Perfiles

| Perfil | Macro | Uso |
|---|---|---|
| Producto | `BIO_RESEARCH_MODE=0` | Funcionamiento normal |
| Investigación | `BIO_RESEARCH_MODE=1` | CSV diagnóstico por Serial |
| Replay | No integrado en BIOSYS 1.0.1 | Permanece en el proyecto BIO independiente |

## Estado de aceptación

- `COMPILE_PASS`: sí.
- `APP_STATIC_CHECKS`: consultar el informe final de integración.
- `HARDWARE_FLASHED`: no en esta entrega.
- `HARDWARE_VALIDATION_REQUIRED`: sí.
- `CLINICAL_VALIDATION`: no.

Los valores HR y SpO2 se ocultan como `--` si no tienen estado válido. SpO2 se rotula experimental por diseño.
