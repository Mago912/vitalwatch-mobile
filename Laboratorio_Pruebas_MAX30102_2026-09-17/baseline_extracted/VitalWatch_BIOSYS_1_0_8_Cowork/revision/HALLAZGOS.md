# Hallazgos de revisión del baseline BIOSYS 1.0.8

Fecha de revisión: 2026-09-17.

## Fuente vigente identificada

La carpeta específica y coherente con la identidad 1.0.8 es
`esp32/VitalWatch_BIOSYS_1_0_8`. El código declara:

- `VERSION_PRODUCTO = 1.0.8`;
- `VERSION_SISTEMA = 0.9.8`;
- `VERSION_BIOMEDICA = 0.6.3`.

El script `scripts/esp32-firmware.ps1` también apunta su objetivo BIOSYS a esa
carpeta y usa `.arduino/build/biosys-1.0.8` como salida.

## Cambios propios de 1.0.8

El delta principal agrega diagnóstico I2C detallado del IMU:

- resultado bruto de `Wire.begin` y `Wire.endTransmission`;
- diferenciación entre ACK, NACK, timeout y error de bus;
- lectura detallada de `WHO_AM_I`;
- escaneo de `0x01..0x7E` con énfasis en `0x57`, `0x68` y `0x69`;
- estado lógico de SDA/SCL;
- diagnóstico completo en el primer fallo y bajo acción manual, conservando
  reintentos automáticos livianos.

Se preservan los parámetros biomédicos de BIO 0.6.3, la detección de impacto,
la TFT, botones, WiFi, telemetría, medicación y mensajería.

## Validación encontrada

- Compilación de producto: PASS.
- Binario registrado: 1.179.040 bytes.
- SHA-256 registrado: `1E0DB33BC408C5C2A0874682964C38614DF6838F2414B804C8BDB71DFCF5F605`.
- Flash usada: 1.178.888 bytes de 1.310.720 (89 %).
- RAM global: 54.704 bytes de 327.680 (16 %).
- Carga física: PASS por COM3.
- MAX30102: PASS, `PART_ID=0x15`.
- IMU: primero no respondió; en una segunda carga respondió en `0x68` con
  `WHO_AM_I=0x70` (MPU6500). La evidencia indica intermitencia física/eléctrica
  y recomienda validar varios reinicios.
- Validación clínica: no realizada.

## Inconsistencias documentales

1. El `README.md` de la carpeta 1.0.8 conserva una sección de compilación de
   1.0.6: indica 1.169.864 bytes y la ruta
   `.arduino/build/biosys-1.0.6/VitalWatch_BIOSYS_1_0_6.ino.bin`. Para 1.0.8,
   prevalecen `MANIFEST.md`, `CAMBIOS_1_0_8.md` y el binario local verificado:
   1.179.040 bytes y el SHA-256 anterior.
2. `MANIFEST.md` registra el primer arranque sin IMU; el documento posterior
   `VALIDACION_IMU_1_0_8.md` agrega el segundo arranque exitoso con MPU6500.
   Ambos resultados son históricos y no deben confundirse con una validación
   estable del hardware.
3. El directorio `build/` dentro de la carpeta fuente mezcla artefactos desde
   1.0.2 hasta 1.0.8. No representa un baseline fuente limpio y fue excluido.

## Exclusiones deliberadas

- `vitalwatch_config.h`: contiene configuración privada.
- Artefactos compilados: además de ser generados, el binario 1.0.8 contiene
  embebidos los cuatro valores privados del dispositivo.
- Versiones anteriores de BIOSYS/FW/BIO: se conservaron en el repositorio, pero
  no forman parte del baseline específico solicitado.
- Documentos generales antiguos que describen 0.9.1, 1.0.2 u otras baselines:
  no se copiaron para evitar mezclar estados históricos con 1.0.8.

## Criterio de uso en Cowork

Usar el código fuente y la documentación de esta entrega para análisis. Antes
de modificar o compilar, corregir o anotar la referencia obsoleta del README y
crear una configuración privada fuera de cualquier paquete compartido.
