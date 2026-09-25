# Cambios de VitalWatch BIOSYS 1.0.8

## Objetivo

Esta revisión agrega observabilidad al enlace I2C del IMU para distinguir una
ausencia real de respuesta, un timeout, un error del controlador, un fallo de
lectura de `WHO_AM_I` y un identificador no admitido. No modifica los umbrales
biomédicos, la detección de impacto, los rangos del sensor ni el MAX30102.

## Cambios funcionales acotados

### I2CBusService

- `begin()` informa si `Wire.begin(GPIO21, GPIO22)` devolvió éxito o fallo.
- `probeAddress()` conserva el código bruto de `Wire.endTransmission()`.
- `resultText()` traduce los códigos `0..5` sin ocultar NACK o timeout.
- `readRegister8Detailed()` separa el resultado de la transmisión de la
  cantidad de bytes recibidos.
- `scanBus()` recorre `0x01..0x7E`, informa cada ACK y destaca `0x57`, `0x68`
  y `0x69`. Los NACK esperables del escaneo no aumentan el contador de errores.
- El resumen del escaneo también informa el nivel observado de SDA y SCL.

### MotionService

- El arranque registra por separado el resultado de `0x68` y `0x69`.
- Si una dirección responde, se registra la transacción de `WHO_AM_I`, la
  cantidad de bytes y el valor leído.
- La interfaz puede mostrar ahora `NACK 0x68/0x69`, `TIMEOUT I2C` o
  `ERROR BUS I2C`, en lugar de agrupar todos los casos bajo `SIN ACK`.
- Si falla el arranque, se ejecuta un escaneo completo una vez.
- Los reintentos automáticos cada tres segundos siguen siendo breves y no
  ejecutan el escaneo completo.
- El diagnóstico manual mediante OK largo ejecuta nuevamente el detalle y el
  escaneo, por tratarse de una acción explícita del usuario.

## Elementos preservados

- ESP32 clásico, FQBN `esp32:esp32:esp32`.
- SDA GPIO21, SCL GPIO22, 100 kHz y timeout de 100 ms.
- Direcciones IMU `0x68` y `0x69`.
- Registro `WHO_AM_I=0x75` e IDs admitidos `0x68`, `0x70`, `0x71`, `0x73`.
- Configuración ±8 g, ±500 dps, filtros, cadencia y umbrales de impacto.
- MAX30102, TFT, botones, WiFi, telemetría, medicación y mensajería.
- BIO permanece en `0.6.3`; no se hizo retuning biomédico.

## Cómo interpretar el Serial

```text
[DIAG][IMU] PROBE addr=0x68 result=2(NACK_DIRECCION)
[DIAG][IMU] PROBE addr=0x69 result=2(NACK_DIRECCION)
[DIAG][IMU] RESULTADO ... etapa=NACK 0x68/0x69
[DIAG][I2C] ACK addr=0x57 role=MAX30102
[DIAG][I2C] SCAN FIN ... 0x68=2(...) 0x69=2(...) SDA=HIGH SCL=HIGH
```

- `0`: ACK/éxito.
- `2`: NACK en dirección; revisar conexión, alimentación y módulo.
- `4`: otro error del controlador I2C.
- `5`: timeout; revisar línea retenida o bus bloqueado.
- ACK en `0x68/0x69` seguido de `SIN WHO_AM_I`: la dirección existe, pero la
  lectura del registro de identidad falló.
- `ID NO SOPORTADO`: `WHO_AM_I` fue leído, pero no coincide con un ID admitido.

## Alcance de validación

- Compilación producto: `PASS` con ESP32 Arduino Core 3.3.11.
- Flash usada: 1.178.888 bytes de 1.310.720 (89 %).
- RAM global: 54.704 bytes de 327.680 (16 %).
- Binario de carga: 1.179.040 bytes, 1.520 bytes más que BIOSYS 1.0.7.
- SHA-256: `1E0DB33BC408C5C2A0874682964C38614DF6838F2414B804C8BDB71DFCF5F605`.
- Carga física: `PASS` en ESP32 clásico por COM3; todos los bloques verificaron
  su hash y el cargador reinició la placa mediante RTS.
- Arranque: `PASS` como `VW-BIOSYS 1.0.8`, `VW-SYS 0.9.8`, `VW-BIO 0.6.3`.
- Diagnóstico capturado: `Wire.begin=OK`; el primer sondeo de `0x68/0x69`
  devolvió timeout. El escaneo inmediatamente posterior encontró solamente
  `0x57` (MAX30102), clasificó `0x68/0x69` como NACK de dirección y observó SDA
  y SCL en HIGH. Los reintentos posteriores conservaron NACK en ambas
  direcciones.
- MAX30102: `PASS`, `PART_ID=0x15`.
- Conclusión de esta ejecución: el bus común funciona y no queda retenido de
  forma permanente; ningún IMU responde en sus dos direcciones admitidas.
  `WHO_AM_I` no llega a ejecutarse. Revisar alimentación, GND, continuidad,
  posición en protoboard y estado del módulo antes de cambiar la detección.

En una segunda carga posterior del mismo binario, el IMU respondió con ACK en
`0x68`, `WHO_AM_I=0x70` y fue identificado correctamente como MPU6500. Esto
clasifica el fallo anterior como intermitente o físico/eléctrico, no como una
incompatibilidad fija del firmware. La estabilidad requiere varios reinicios.
