# Validación de BIOSYS 1.0.0 en hardware

## Antes de cargar

- Guardar una copia del binario SYS 0.9.1 actualmente probado.
- Confirmar alimentación estable, cable USB de datos y puerto COM.
- Revisar que `vitalwatch_config.h` tenga valores reales y no marcadores.
- Desconectar cualquier fuente externa incompatible antes de conectar USB.
- Ejecutar `npm run firmware:biosys:build` y conservar el resultado.

## Carga

1. Ejecutar `npm run firmware:ports`.
2. Ejecutar `npm run firmware:biosys:upload -- -Port COM3`, sustituyendo el puerto.
3. Si queda en `Connecting...`, mantener `IO0/BOOT`, pulsar brevemente `EN/RESET` si existe y soltar `IO0` cuando comience la escritura.
4. No desconectar hasta que la verificación finalice.
5. Si no reinicia, pulsar una vez `EN/RESET`, sin mantener `IO0`.

## Prueba de arranque

- Serial a 115200 muestra `[READY] VitalWatch VW-BIOSYS 1.0.0`.
- El splash aparece sin parpadeos anormales.
- La vista Estado muestra BIOSYS 1.0.0, SYS 0.9.1 y BIO 0.6.0.
- IMU y MAX30102 figuran detectados; anotar modelo y cualquier error.

## Prueba funcional local

- Izquierda/derecha recorren todas las opciones.
- OK entra/sale; OK largo mantiene su función prevista.
- La combinación SOS se activa solo con la pulsación definida.
- La vista Movimiento se actualiza al mover la pulsera.
- Una prueba de impacto controlada se rotula como posible impacto.
- Sin dedo, HR y SpO2 muestran `--`/sin contacto.
- Con contacto estable, se recorren estabilización, medición y resultado o baja calidad.
- Retirar el dedo devuelve el estado a sin contacto.

## Prueba con app 1.0.3

- Abrir Pulsera y confirmar BIOSYS 1.0.0 con sus componentes.
- Encender/apagar la TFT desde la app.
- Abrir signos, movimiento, estado y medicación de forma remota.
- Confirmar que la TFT física y la réplica de la app concuerdan.
- Verificar sincronización de medicación y acción “tomado”.
- Confirmar recepción de telemetría; un resultado inválido no debe aparecer como cero válido.

## Prueba de estabilidad

- Ejecutar al menos 30 minutos con navegación, WiFi y sensores activos.
- Repetir con pérdida/recuperación de WiFi.
- Vigilar `loopMax`, `ppgDrops`, `imuMiss`, `i2cErrors` con el comando Serial `I`.
- Realizar además una prueba de más de 75 minutos antes de declarar resuelto el riesgo de rollover temporal.

## Criterio de retroceso

Volver a SYS 0.9.1 si hay reinicios, pantalla no operativa, pérdida persistente de I²C, bloqueo de botones/SOS o fallos de red que impidan la función principal. No ajustar umbrales biomédicos durante la misma prueba: registrar primero el comportamiento observado.

## Registro mínimo

Anotar fecha, placa, sensores, versión BIOSYS/SYS/BIO, hash del binario, puerto, resultado de cada prueba y captura del Serial. Una compilación correcta no equivale a validación física ni clínica.
