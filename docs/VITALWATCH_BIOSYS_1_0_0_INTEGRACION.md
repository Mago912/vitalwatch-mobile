# Informe de integración — VitalWatch BIOSYS 1.0.0

Fecha técnica: 2026-09-01

## Resultado

Se creó `esp32/VitalWatch_BIOSYS_1_0_0` como firmware unificado. Mantiene visibles y separadas sus bases `SYS 0.9.1` y `BIO 0.6.0`; las carpetas originales no fueron reemplazadas.

Arquitectura aplicada:

- SYS conserva pantalla, navegación, botones/SOS, WiFi, medicación, control remoto y transporte.
- BIO aporta una sola implementación PPG y una sola implementación IMU.
- BIOSYS conecta ambos contratos, adapta UI/telemetría y publica la versión compuesta.
- La app 1.0.3 muestra BIOSYS y el desglose de sus componentes en Pulsera.

## Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| Compilación BIOSYS normal | PASS |
| Flash normal | 1.160.196 B de 1.310.720 B (88 %) |
| RAM estática normal | 53.872 B de 327.680 B (16 %) |
| Compilación BIOSYS investigación | PASS |
| Flash investigación | 1.162.112 B (88 %) |
| RAM estática investigación | 57.664 B (17 %) |
| Expo ESLint | PASS |
| TypeScript `--noEmit` | PASS |
| Sintaxis PowerShell | PASS |
| `package.json` | PASS |

No se cargó BIOSYS al ESP32 durante esta tarea. La placa conserva el firmware que tenía antes de la integración.

## Entregables

- Código fuente: `esp32/VitalWatch_BIOSYS_1_0_0/`.
- ZIP Arduino sanitizado: `docs/VitalWatch_BIOSYS_1_0_0_Arduino.zip`.
- Binario local: `.arduino/build/biosys-1.0.0/VitalWatch_BIOSYS_1_0_0.ino.bin`.
- Documentación detallada dentro de la carpeta del sketch.

El ZIP excluye intencionalmente `vitalwatch_config.h`, carpetas de build y credenciales. Sí incluye `vitalwatch_config.example.h`.

## Integridad

- SHA-256 binario: `983B7747ABF6B89C172BC98E554E56490C52E65E5726DBDDD501075CCB421EB8`
- SHA-256 ZIP: `D0F22B7B4181DF7E80A8727CB41D04D3070260D798C26CD319720AACB0577BC5`

## Próxima decisión

La siguiente fase es cargar BIOSYS, observar el arranque Serial y ejecutar `VALIDACION_HARDWARE.md`. La optimización de bytes debe hacerse después de esa prueba y conservar como línea base este binario/hashes.
