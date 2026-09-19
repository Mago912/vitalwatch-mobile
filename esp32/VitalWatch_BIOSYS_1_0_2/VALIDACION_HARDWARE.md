# Validación física — BIOSYS 1.0.2

## 1. Preparación y retroceso

- Conservar BIOSYS 1.0.1 y su binario/ZIP como retorno seguro.
- Confirmar cable USB de datos, alimentación estable y puerto COM real.
- Verificar localmente `vitalwatch_config.h` sin copiar ni mostrar sus valores.
- Compilar primero con `npm run firmware:biosys:build`.
- No cambiar umbrales durante esta prueba; primero registrar evidencia.

## 2. Arranque

Después de cargar, abrir Serial a 115200 y comprobar:

```text
[READY] VitalWatch VW-BIOSYS 1.0.2 | incluye VW-SYS 0.9.3 + VW-BIO 0.6.1
```

La vista Estado debe presentar las mismas tres versiones y marcar IMU/MAX30102
según la detección real.

### Registro ejecutado — 2026-09-02

- Windows reconoció el conversor como `Silicon Labs CP210x USB to UART Bridge
  (COM3)` después de instalar el paquete oficial VCP.
- La carga por COM3 terminó con verificación de hash en cada bloque y reinicio
  automático.
- Arranque confirmado: `VW-BIOSYS 1.0.2`, `VW-SYS 0.9.3`, `VW-BIO 0.6.1`.
- MAX30102 detectado: `PART_ID=0x15`.
- Sin dedo: `IR=2574`, `red=2609`, `contacto=0`, `SIN DATOS`.
- Con dedo quieto: primero hubo saturación (`red/IR=262143`); la autoganancia
  redujo el LED de 112 a 53 y luego se obtuvo `SpO2 EXP VALIDA`, calidad
  `BUENA`, `modIR=1.021`, `modR=0.670`, `maxim=100/1`. FC quedó `INESTABLE`.
- La saturación inicial obliga a repetir con presión suave y montaje estable;
  no se cambian umbrales todavía. La IMU reportó una variante no validada
  (`MPU6500`, `WHO_AM_I=0x70`).

## 3. Pantalla de signos y MAX30102

Registrar esta tabla sin usar los datos para diagnóstico médico:

| Caso | Texto de sesión | IR | LED | Calidad | FC/SpO2 |
|---|---|---:|---:|---|---|
| Sin dedo | | | | | |
| Dedo quieto, luz normal | | | | | |
| Dedo quieto, luz lateral bloqueada | | | | | |
| Dedo retirado | | | | | |

Procedimiento:

1. Dejar el sensor libre durante 5 segundos y anotar `IR`, `L` y `C`.
2. Apoyar la yema directamente y con presión suave/constante.
3. Confirmar la secuencia `PONGA EL DEDO` → `ESTABILIZANDO` → `MIDIENDO`.
4. Mantenerse quieto hasta resultado o `TIEMPO AGOTADO`.
5. Retirar el dedo y confirmar el regreso a `PONGA EL DEDO`.
6. Repetir con una barrera negra mate alrededor del sensor, sin cubrir las
   ventanas ópticas.
7. En cada caso enviar `P` por Serial y guardar la línea `[DIAG][PPG]`.

Interpretación de los umbrales actuales:

- IR menor que `7000`: la señal no activa la autoganancia precontacto;
- IR entre `7000` y `14000`: BIOSYS 1.0.2 puede elevar el LED gradualmente;
- IR mayor que `14000` durante 120 ms: puede confirmar contacto;
- objetivo durante estabilización: IR entre `38000` y `90000`;
- valores cercanos o superiores a `250000`: la calidad se rechaza por
  saturación.

Si con dedo el IR permanece por debajo de 7000, enviar las tres líneas `P`, una
foto del módulo/montaje y confirmar alimentación/pines antes de modificar el
umbral. Si entra en `MIDIENDO` pero queda en `SENAL BAJA`, registrar además
`drops`, `ovf`, `modIR`, `modR` y `maxim` de la misma línea.

## 4. Prueba de navegación local/remota

1. En la app 1.0.4 seleccionar `Signos vitales` y esperar confirmación.
2. Con los botones físicos ir a `Estado`.
3. Esperar al menos 10 segundos. Debe permanecer en Estado.
4. Confirmar en la app que `Solicitado` puede seguir diciendo Signos, pero
   `Confirmado por BIOSYS` cambia a Estado.
5. Ir físicamente a Medicación y repetir la espera.
6. Pulsar otra vista en la app. Esa nueva orden debe aplicarse una vez.
7. Volver a cambiar físicamente; la nueva vista local debe permanecer.
8. Probar Encender/Apagar. La orden de energía debe seguir confirmándose.
9. Repetir con una alerta controlada: impacto/SOS conserva prioridad y OK local
   o remoto debe cerrarla.

## 5. Regresión general

- splash, colores, footer y botones;
- portal WiFi, reconexión y NVS;
- medicación app → TFT → tomado → app;
- telemetría con nulos cuando PPG no es válida;
- IMU y posible impacto controlado, sin golpear personas ni la placa;
- SOS y confirmación de alertas;
- al menos 30 minutos observando `I` y `P` por Serial.

Volver a BIOSYS 1.0.1 si aparecen reinicios, bloqueo de botones/SOS, pérdida
persistente del bus I2C o regresión de WiFi/medicación. Compilar no sustituye
esta validación y ninguna lectura de VitalWatch es clínicamente validada.
