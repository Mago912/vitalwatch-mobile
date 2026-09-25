# Validación física del IMU — BIOSYS 1.0.8

## Ejecución

- Fecha: 2026-09-16.
- Placa: ESP32 Dev Module clásico.
- Puerto: COM3.
- Firmware: VW-BIOSYS 1.0.8, SYS 0.9.8, BIO 0.6.3.
- Core: ESP32 Arduino 3.3.11.
- SDA: GPIO21.
- SCL: GPIO22.
- Frecuencia: 100 kHz.
- Timeout: 100 ms.

## Resultado de carga

La escritura de bootloader, particiones, `boot_app0` y aplicación finalizó sin
errores. Esptool verificó el hash de cada bloque y reinició la placa mediante
RTS.

## Evidencia Serial relevante

```text
[INFO][I2C] init=OK SDA=21 SCL=22 clock=100000Hz timeout=100ms
[DIAG][IMU] PROBE addr=0x68 result=5(TIMEOUT)
[DIAG][IMU] PROBE addr=0x69 result=5(TIMEOUT)
[DIAG][IMU] RESULTADO 0x68=5(TIMEOUT) 0x69=5(TIMEOUT) etapa=TIMEOUT I2C
[DIAG][I2C] SCAN INICIO SDA=21 SCL=22 clock=100000Hz timeout=100ms
[DIAG][I2C] ACK addr=0x57 role=MAX30102
[DIAG][I2C] SCAN FIN devices=1 0x68=2(NACK_DIRECCION) 0x69=2(NACK_DIRECCION) SDA=HIGH SCL=HIGH
[INFO][PPG] MAX30102 PART_ID=0x15 100Hz/AVG4 => ~25 FIFO records/s
[WARN][IMU] No disponible: NACK 0x68/0x69
[READY] VitalWatch VW-BIOSYS 1.0.8 | incluye VW-SYS 0.9.8 + VW-BIO 0.6.3
```

## Interpretación

1. `Wire.begin()` inicializó el controlador con los GPIO previstos.
2. El MAX30102 respondió correctamente en `0x57` sobre el mismo bus.
3. El escáner no encontró ningún dispositivo en `0x68` ni en `0x69`.
4. SDA y SCL terminaron en nivel alto; no existe evidencia de una línea
   permanentemente retenida en LOW.
5. Los reintentos posteriores devolvieron NACK estable en ambas direcciones.
6. El firmware no alcanza la lectura de `WHO_AM_I`; un ID MPU6050/MPU6500
   incompatible no explica esta ejecución.

El timeout inicial muestra que hubo una condición transitoria durante los dos
primeros sondeos. Como el escaneo posterior y los reintentos se normalizaron a
NACK, no demuestra por sí solo que el controlador I2C esté averiado.

## Próxima comprobación recomendada

Con el equipo apagado:

1. confirmar continuidad GPIO21–SDA y GPIO22–SCL;
2. confirmar continuidad de GND común;
3. verificar que el VCC del IMU está en la fila correcta del protoboard;
4. encender y medir la tensión directamente entre VCC y GND del módulo;
5. volver a ejecutar OK largo para repetir el diagnóstico;
6. si persiste el NACK, probar el IMU aislado del resto del montaje o sustituir
   temporalmente el módulo por una unidad conocida.

No se recomienda cambiar dirección, IDs admitidos ni lógica `WHO_AM_I` antes
de que el módulo aparezca en `0x68` o `0x69`.

## Segunda carga y arranque posterior

Después de restaurar temporalmente BIOSYS 1.0.6, se volvió a cargar exactamente
el binario verificado de BIOSYS 1.0.8. En este nuevo arranque el resultado fue:

```text
[INFO][I2C] init=OK SDA=21 SCL=22 clock=100000Hz timeout=100ms
[DIAG][IMU] PROBE addr=0x68 result=0(ACK/OK)
[DIAG][IMU] WHO_AM_I addr=0x68 success=1 tx=0(ACK/OK) bytes=1 value=0x70
[INFO][IMU] MPU6500 addr=0x68 WHO_AM_I=0x70 status=UNVALIDATED_VARIANT
[INFO][PPG] MAX30102 PART_ID=0x15 100Hz/AVG4 => ~25 FIFO records/s
[READY] VitalWatch VW-BIOSYS 1.0.8 | incluye VW-SYS 0.9.8 + VW-BIO 0.6.3
[INFO][TEL] Telemetria enviada
```

Este resultado confirma que:

1. el módulo físico puede responder en `0x68`;
2. su identidad real es MPU6500, `WHO_AM_I=0x70`;
3. BIOSYS 1.0.8 acepta correctamente ese identificador;
4. el fallo anterior fue intermitente o dependiente del estado físico/eléctrico
   del montaje, no una incompatibilidad fija de dirección o modelo;
5. conviene observar varios reinicios y revisar falsos contactos antes de
   considerar el problema definitivamente resuelto.
