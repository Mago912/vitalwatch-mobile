# VITALWATCH — START HERE

Fecha de auditoría: 2026-09-01  
Repositorio revisado: `D:\vitalwatch-mobile`

## Cómo leer este paquete

Estados operativos usados:

- `WORKING`: hay evidencia de funcionamiento.
- `PARTIALLY_WORKING`: funciona una parte o falta revalidar el estado actual.
- `EXPERIMENTAL`: implementación de prototipo, sin validación suficiente.
- `NOT_TESTED`: existe código, pero no hay prueba real confirmada.
- `DEPRECATED`: se conserva por historia; no es la versión a desarrollar.
- `PENDING`: todavía no está implementado o comprobado.

Evidencia:

- `F`: confirmado al revisar archivos o ejecutar una comprobación en esta auditoría.
- `U`: proporcionado por el usuario o registrado como prueba anterior.
- `H`: hipótesis que todavía debe comprobarse.
- `R`: recomendación para continuar.
- `P`: pendiente de comprobación.

Estas dos clases de etiquetas no significan lo mismo. Por ejemplo,
`PARTIALLY_WORKING — U` indica un estado operativo parcial respaldado por una
prueba informada anteriormente.

## Proyecto

VitalWatch es un prototipo académico formado por tres partes:

1. una pulsera basada en ESP32 con pantalla, sensores y botones;
2. una aplicación móvil React Native/Expo;
3. un backend Supabase para autenticación, datos, medicamentos, telemetría,
   control de pantalla y notificaciones.

El objetivo es ayudar a supervisar a una persona adulta mayor. No es un
dispositivo médico y sus mediciones no deben usarse para diagnóstico.

## CURRENT BASELINE

| Elemento | Baseline real | Estado | Evidencia |
| --- | --- | --- | --- |
| Firmware disponible | `esp32/VitalWatch_FW_0_9_0/VitalWatch_FW_0_9_0.ino` | `PARTIALLY_WORKING` | F, U |
| Versión declarada por el código | `0.9.0` | `WORKING` | F |
| Firmware físicamente probado | una revisión anterior de `0.9.0` | `WORKING` | U |
| Árbol actual de `0.9.0` | coincide con el commit `49df2d5` y con el ZIP histórico 0.9.0 | `PARTIALLY_WORKING` | F, U |
| Firmware candidato `VW-SYS 0.9.1` | `esp32/VitalWatch_FW_0_9_1/` | compila; `NOT_TESTED` en hardware | F, U |
| Perfil biomédico `VW-BIO 0.6.0` | `esp32/VitalWatch_BIO_0_6_0/` | compila normal/research/replay; hardware y dataset pendientes | F, P |
| App móvil recuperada | Expo SDK 54, app `1.0.3`, Pulsera virtual completa | `PARTIALLY_WORKING` | F, U |
| Backend | Supabase + Edge Functions + RLS; migración de fecha recuperada | `PARTIALLY_WORKING` | F, U |
| Proyecto Supabase | `sehuynlvfvgfhelqpbrx` | `WORKING` | U |
| Dispositivo de prueba | `VW-001` | `WORKING` | U |

### Recuperación resuelta y alcance actual

La fuente auténtica de `0.9.1` fue entregada después de la primera auditoría.
Incluye el firmware completo, `app/(tabs)/watch.tsx`,
`components/virtual-tft.tsx`, la migración de `scheduled_date`,
`.env.example` y `ESTADO_PROYECTO.md`.

`CONTEXT RESOLVED — F`: `VW-SYS 0.9.0` queda como baseline histórico y
`VW-SYS 0.9.1` como candidato actual. La fuente recuperada fue integrada de
forma no destructiva en `D:\vitalwatch-mobile` y su build finaliza con codigo 0.
La capa de laboratorio se conserva aparte como `VW-BIO 0.6.0`; no equivale al
firmware integral ni fue promovida dentro de el.

Comparación comprobada:

- el `0.9.0` local coincide completo con el commit remoto `49df2d5` y con
  `D:\VitalWatch_0_9_0_PARA_OTRA_PC.zip` — F;
- los módulos funcionales de `0.9.1` coinciden con las mejoras publicadas en
  el commit `64577e2`, que habían sido aplicadas dentro de la carpeta 0.9.0;
- `0.9.1` separa esas mejoras en una carpeta nueva y declara versión `0.9.1`;
- no se atribuye todavía una regresión física completa a `0.9.1` — P.

## Hardware actual

- ESP32 NodeMCU/Dev Module clásico de 38 pines — `WORKING — U`.
- TFT ST7735 de 1.44 pulgadas, 128×128, variante
  `INITR_144GREENTAB` — `WORKING — F, U`.
- MAX30102 en I²C `0x57` — detección física `WORKING — U`; mediciones
  biomédicas `EXPERIMENTAL — F`.
- IMU compatible MPU60xx/65xx en `0x68` o `0x69` — `WORKING — U`.
- El hardware físico reportó MPU6500 (`WHO_AM_I 0x70`), aunque parte de la
  solicitud lo llama MPU6050 — `CONTEXT CONFLICT — U, F`.
- Tres botones a GND con `INPUT_PULLUP` — `WORKING — F, U`.
- No existe circuito de batería ADC confirmado; el firmware usa
  `PIN_BATERIA_ADC = -1` — `PENDING — F`.

Ver cableado exacto en `02_HARDWARE_BASELINE.md`.

## Firmware actual

El baseline estable conservado en el repositorio es:

```text
esp32/VitalWatch_FW_0_9_0/VitalWatch_FW_0_9_0.ino
```

El candidato integrado en el repositorio es:

```text
D:\vitalwatch-mobile\esp32\VitalWatch_FW_0_9_1\VitalWatch_FW_0_9_1.ino
```

Módulos activos:

```text
Main 0.9.0 / 0.9.1
├── Configuracion.h
├── Botones.h
├── Sensor_Movimiento.h
├── Sensor_Oxigeno.h
├── Configuracion_WiFi.h
├── Control_Remoto.h
├── Sincronizacion_Medicacion.h
├── Interfaz.h
└── Telemetria.h
```

El `loop()` mantiene sensores, botones, eventos y UI de forma cooperativa. El
trabajo HTTPS se envía a una tarea FreeRTOS en el núcleo 0 para reducir bloqueos
del muestreo.

## Qué funciona

- TFT, orientación, colores y navegación física — `WORKING — U`.
- Portal WiFi desde el celular, memoria NVS y reconexión — `WORKING — U`.
- WiFi 2.4 GHz configurado físicamente — `WORKING — U`.
- Sincronización app → Supabase → TFT de medicamentos — `WORKING — U`.
- Confirmación con OK largo y reflejo “Tomado” en la app — `WORKING — U`.
- MAX30102 e IMU detectados físicamente — `WORKING — U`.
- Telemetría inicial real hacia Supabase — `WORKING — U`.
- El firmware no inventa batería cuando no hay ADC — `WORKING — F, U`.
- Auth, vinculación, RLS, medicamentos y push Android — `WORKING — U`.
- Lint y TypeScript de la app pasaron el 2026-09-01 — `WORKING — F`.
- La versión `0.9.0` implementa control remoto de encendido lógico y de vista,
  con hasta 30 segundos de demora — `PARTIALLY_WORKING — F, U`.
- La fuente recuperada de `0.9.1` contiene fecha en TFT, medicamentos cada 5 s
  y control remoto cada 1 s — `NOT_TESTED` en hardware — F.
- La app recuperada contiene `watch.tsx` y `virtual-tft.tsx`; el snapshot
  completo pasó TypeScript y ambos archivos pasaron ESLint — F.

## Qué está en desarrollo

- Revalidar físicamente `VW-SYS 0.9.1` — compilación `WORKING — F`; hardware `PENDING — P`.
- Validar `VW-BIO 0.6.0` con hardware y dataset antes de promoverlo — `PENDING — P`.
- Generar y probar un APK 1.0.3 con Pulsera virtual — `PENDING — F`.
- Verificar la migración de fecha contra el proyecto Supabase desplegado — `PENDING — F`.
- Validación repetida de BPM, SpO₂ e impacto — `PENDING — F, U`.
- Lectura real de batería y ahorro eléctrico de backlight — `PENDING — F`.

## Problemas conocidos

1. `HIGH`: Git local sigue incompleto y no debe repararse destructivamente.
2. `HIGH`: `VW-SYS 0.9.1` compila, pero no tiene regresión física atribuible a su fuente actual.
3. `HIGH`: `VW-BIO 0.6.0` compila, pero no tiene dataset ni validación física.
4. `HIGH`: la migración está recuperada, pero falta verificar el despliegue remoto.
5. `HIGH`: BPM, SpO₂ y detección de caída siguen siendo experimentales.
6. `MEDIUM`: HTTPS del ESP32 usa `setInsecure()`.
7. `MEDIUM`: el portal comparte una clave fija para todas las pulseras del
   prototipo.
8. `MEDIUM`: la luz TFT sigue alimentada si LED está conectado directo a 3V3.

Detalles y clasificación en `09_BUGS_AND_KNOWN_ISSUES.md`.

## Próximo objetivo

La base recuperada ya fue integrada y compilada. El próximo objetivo depende de
la nueva tarea del usuario. Para firmware: ejecutar regresión física de
`VW-SYS 0.9.1`; validar `VW-BIO 0.6.0` con hardware/dataset; promover la capa BIO
al sistema sólo después de comparar replay y preservar `VW-SYS 0.9.0`.

Ver el orden detallado en `12_PENDING_WORK.md`.

## Archivos que otro chat debería leer después

Orden recomendado:

1. `SOURCE_OF_TRUTH.md`
2. `14_SYS_BIO_VERSIONING.md`
3. `09_BUGS_AND_KNOWN_ISSUES.md`
4. `10_TESTING_STATUS.md`
5. `03_FIRMWARE_ARCHITECTURE.md`
6. `06_BIOMEDICAL_STATUS.md`
7. `11_DECISIONS_AND_CONSTRAINTS.md`
8. `12_PENDING_WORK.md`
9. `esp32/VitalWatch_FW_0_9_0/`, `esp32/VitalWatch_FW_0_9_1/` y
   `esp32/VitalWatch_BIO_0_6_0/`

Para abrir un chat limpio, copiar `13_NEXT_CHAT_PROMPT.md` y adjuntar los
archivos indicados allí.
