# VITALWATCH — CONTINUATION PROMPT

Quiero continuar el proyecto VitalWatch existente. No empieces desde cero, no
recrees la aplicación y no reemplaces firmware estable por una reescritura.
Explícame todo en español y de forma sencilla porque tengo nivel
básico/intermedio de programación.

## Regla inmediata

Antes de modificar nada:

1. ejecuta `git status`;
2. lee completos `AGENTS.md` y `docs/context-handoff/00_START_HERE.md`;
3. lee `docs/context-handoff/SOURCE_OF_TRUTH.md`;
4. lee `docs/context-handoff/09_BUGS_AND_KNOWN_ISSUES.md`;
5. lee `docs/context-handoff/10_TESTING_STATUS.md`;
6. inspecciona los archivos reales de la tarea;
7. conserva todos los cambios locales.

No uses `git reset`, `git checkout --`, `git clean` ni borres cambios. No
publiques ni muestres valores de `.env.local`, `.env.simulator.local`,
`PAIRING_CODE.local.txt`, secretos Supabase, contraseñas WiFi, tokens del
dispositivo o cualquier `vitalwatch_config.h`.

## Proyecto

VitalWatch es un prototipo académico para supervisión de una persona adulta
mayor. Tiene:

- una pulsera ESP32 con TFT, MAX30102, IMU y tres botones;
- una app React Native con Expo SDK 54 y Expo Router;
- Supabase para Auth, RLS, dispositivos, telemetría, medicamentos, control TFT
  y notificaciones.

No es un dispositivo médico. BPM, SpO₂ y detección de caídas son
experimentales. No hagas afirmaciones clínicas.

## Hardware confirmado

- ESP32 NodeMCU/Dev Module clásico de 38 pines.
- TFT ST7735 de 1.44 pulgadas, 128×128,
  `INITR_144GREENTAB`, rotación 1.
- MAX30102 en I²C `0x57`.
- IMU en `0x68` o `0x69`. La unidad física se detectó como MPU6500
  (`WHO_AM_I 0x70`), aunque el firmware también acepta MPU6050/9250/9255.
- I²C: SDA GPIO21, SCL GPIO22, 100 kHz.
- TFT: SCK18, MOSI23, DC2, RESET4, CS5, LED/VCC 3V3 y GND común.
- Botones a GND con `INPUT_PULLUP`: izquierda25, OK26, derecha27.
- No hay circuito ADC de batería confirmado; `PIN_BATERIA_ADC = -1`.
- LED TFT está directo a 3V3, por lo que dormir el controlador no apaga la luz.

No cambies GPIO, alimentación, variante TFT o librerías sin evidencia y prueba
física. Nunca conectes LiPo ni LED completo directamente a un GPIO.

## Baseline real y fuente recuperada

El firmware estable conservado en el workspace es:

```text
esp32/VitalWatch_FW_0_9_0/VitalWatch_FW_0_9_0.ino
```

El código declara versión `0.9.0`. La auditoría demostró que sus 13 archivos
coinciden con el commit `49df2d5` y el ZIP histórico 0.9.0 — F. Una revisión de
0.9.0 fue probada físicamente — U; no existe hash del binario cargado.

El firmware candidato actual fue integrado en:

```text
D:\vitalwatch-mobile\esp32\VitalWatch_FW_0_9_1\VitalWatch_FW_0_9_1.ino
```

Declara versión `0.9.1`, sincroniza medicamentos cada 5 s, consulta control TFT
cada 1 s y muestra fecha. No lo recrees ni lo reemplaces: usa esa fuente exacta.
Compila como `VW-SYS 0.9.1`, pero todavía no fue probada físicamente. La rama
biomédica separada está en `esp32/VitalWatch_BIO_0_6_0/`, declara
`VW-BIO 0.6.0`, compila normal/research/replay y necesita hardware/dataset.

## Problema Git

`git status` funciona, pero `git log`/`git diff` fallan por objetos ausentes. En
la auditoría del 2026-09-01 había 20 archivos versionados modificados o borrados.
No repares destructivamente esta copia. Primero haz una copia externa y compara
con un clon limpio.

## Arquitectura firmware 0.9.0

```text
VitalWatch_FW_0_9_0.ino
├── Configuracion.h             pines, tiempos, estados, TFT e I²C
├── Botones.h                   rebote, OK largo y SOS
├── Sensor_Movimiento.h         MPU e impacto experimental
├── Sensor_Oxigeno.h            MAX30102, BPM, SpO₂ y calidad
├── Configuracion_WiFi.h        portal, NVS y reconexión
├── Control_Remoto.h            sueño/vista TFT y confirmación
├── Sincronizacion_Medicacion.h tarea FreeRTOS, meds, red y transporte
├── Interfaz.h                  pantallas 128×128
├── Telemetria.h                lecturas periódicas, caída y SOS
└── LogoVitalWatch.h            bitmaps RGB565
```

El loop atiende control TFT, botones, sensores, eventos y UI. Las llamadas
HTTPS se hacen en una tarea FreeRTOS fijada al núcleo 0. La tarea de red nunca
debe dibujar directamente en la TFT; deja una orden y el loop la aplica.

## Funciones físicamente comprobadas antes

- TFT con colores/orientación correctos.
- Portal WiFi desde celular y red 2.4 GHz.
- MAX30102 e IMU detectados.
- Medicamento creado en app apareció en TFT.
- OK largo lo marcó como tomado y la app reflejó el cambio.
- Primera telemetría real llegó a Supabase.
- Sin dedo válido, BPM/SpO₂ quedaron nulos.
- Sin ADC, batería quedó nula, no inventada.
- Auth, vínculo VW-001, RLS y push Android funcionaron.

La fuente actual 0.9.0 es reproducible, pero no atribuyas automáticamente estas
pruebas a 0.9.1. Repite la regresión después de integrarla y compilarla.

## Algoritmos biomédicos

`Sensor_Oxigeno.h` y `Sensor_Movimiento.h` conservan el mismo contenido desde
0.5.0 hasta la fuente 0.9.1 entregada. Presérvalos durante trabajos de UI/red.

MAX30102:

- dedo IR 14,000; retiro 8,500;
- calibración 3.2 s; medición guiada 20 s;
- intervalos de pulso 330–1,600 ms;
- ventana SpO₂ 100, actualización 25, decimación 4, historial 5;
- algoritmo SparkFun/Maxim;
- resultados válidos/aproximados y calidad.

IMU:

- ±8 g, ±500 °/s, objetivo 100 Hz;
- impacto fuerte 1.70 g, moderado 1.32 g, variación 0.48 g;
- giro 1.15 rad/s, variación 0.70 rad/s.

Todos esos umbrales son experimentales. Los cambios deben venir de un protocolo
del Biomedical Algorithms Lab con comparación contra referencia.

## UI TFT

Pantallas: splash, menú, signos, movimiento, estado, medicación, configuración
WiFi, alerta de impacto y SOS. Fondo oscuro, alto contraste, barra superior y
footer. Las alertas son rojas y tienen prioridad.

0.9.0 muestra hora, nombre, dosis y estado; consulta cada 30 s. 0.9.1 agrega
fecha `DD/MM/YYYY`, medicamentos cada 5 s y control TFT cada 1 s. Esta
implementación existe en la fuente entregada, pero requiere prueba física.

## App móvil

Versiones principales:

- app 1.0.3;
- Expo `~54.0.37`;
- Expo Router `~6.0.23`;
- React Native `0.81.5`;
- React `19.1.0`;
- TypeScript `~5.9.2` estricto;
- Supabase JS `^2.112.0`.

La fuente entregada contiene Inicio, Historial, Medicación, Configuración,
sign-in, pair-device y Pulsera virtual. Esta última requiere los dos archivos
recuperados `app/(tabs)/watch.tsx` y `components/virtual-tft.tsx`.

El 2026-09-01 pasaron:

```text
npm run lint
npx tsc --noEmit
```

El snapshot completo recuperado también pasó TypeScript y los dos archivos de
Pulsera pasaron ESLint. Esto no valida rutas en un APK ni Edge Functions. La
app 1.0.3 necesita prueba en un APK nuevo. iOS sigue pospuesto.

## Supabase

Proyecto: `sehuynlvfvgfhelqpbrx`. Dispositivo demo: `VW-001`.

Hay Edge Functions para vinculación, registro/envío push, medicamentos del
dispositivo y telemetría. RLS separa usuarios; ESP32 usa token propio con hash.
La prueba de seguridad pasó anteriormente con accesos anónimos/tokens
incorrectos bloqueados. En el snapshot completo, el script y la carpeta 0.9.1
son coherentes; ejecutarlo requiere la configuración privada y autorización.

La migración `20260831151703_add_medication_schedule_date.sql` fue recuperada
desde la fuente entregada y coincide con el commit remoto `64577e2`. Todavía
debe integrarse localmente y verificarse contra Supabase remoto.

## Dependencias firmware que deben preservarse

- Arduino CLI 1.5.1;
- ESP32 core 3.3.11;
- ArduinoJson 7.4.3;
- Adafruit GFX 1.12.6;
- Adafruit ST7735/ST7789 1.11.0;
- SparkFun MAX3010x 1.1.2.

## Problemas prioritarios

1. Git local con objetos faltantes.
2. `VW-SYS 0.9.1` integrado y compilado, pero sin regresión física actual.
3. `VW-BIO 0.6.0` compilado, pero sin hardware/dataset.
4. Migración y Pulsera virtual recuperadas pero no integradas.
5. APK 1.0.3 con Pulsera virtual no probado.
6. Estado remoto de la migración no verificado.
7. BPM/SpO₂/caída no validados.
8. HTTPS usa `setInsecure()`.
9. batería y backlight requieren hardware.

## Estados y criterio de evidencia

Usa estos estados operativos: `WORKING`, `PARTIALLY_WORKING`, `EXPERIMENTAL`,
`NOT_TESTED`, `DEPRECATED` y `PENDING`. No llames `WORKING` a una función solo
porque el código existe.

Cuando necesites explicar por qué afirmas algo, usa:

- `F`: confirmado al revisar código o ejecutar una prueba actual;
- `U`: proporcionado por el usuario o registrado en una prueba anterior;
- `H`: hipótesis pendiente;
- `R`: recomendación;
- `P`: comprobación pendiente.

Da prioridad a código actual, pruebas sobre ese código, evidencia física del
usuario y finalmente documentación. Si dos fuentes se contradicen, escribe
`CONTEXT CONFLICT` y no elijas silenciosamente una.

## Comandos y rutas en el estado actual

Los siguientes comandos de app son válidos y pasaron en esta auditoría:

```powershell
npm run lint
npx tsc --noEmit
```

Dentro de `D:\vitalwatch-mobile` son válidos:

```powershell
npm run firmware:stable:build
npm run firmware:build
npm run firmware:bio:build
npm run firmware:bio:research
npm run firmware:bio:replay
```

No ejecutes upload sin autorización porque cambia el ESP32. Configuración,
seguridad y despliegues requieren sus privados y alcance explícito.

No ejecutes `npm install` si no hace falta: `node_modules` ya existe y el
lockfile tiene cambios locales. Si una instalación se vuelve necesaria, revisa
antes `git status`, versiones Node/npm y el impacto sobre `package-lock.json`.

## Regresión obligatoria después de integrar el baseline

Cuando yo autorice cambios y exista una fuente definida, la integración solo se
considerará terminada después de:

1. compilar y registrar flash/RAM;
2. cargar en el puerto real, nunca `COM1 Unknown`;
3. revisar el boot a 115200;
4. confirmar TFT, botones, MAX30102 e IMU;
5. configurar/cambiar una red 2.4 GHz y verificar reconexión;
6. crear un medicamento, verlo, marcarlo tomado y verlo en app;
7. probar las cinco vistas remotas y la confirmación;
8. comprobar telemetría válida y nula;
9. probar SOS y caída de forma controlada, sin golpear placa/personas;
10. verificar eventos, historial y push Android.

Guarda hashes, logs sin secretos, versión de APK y resultados. Si falla un paso,
no declares completa la integración.

## DO NOT BREAK

- flujo app → Supabase → TFT → tomado → app;
- sensores continuos;
- portal WiFi/NVS;
- GPIO y buses confirmados;
- prioridad de SOS/impacto/botones/portal;
- datos inválidos nulos;
- RLS y token separado del ESP32;
- push Android;
- UI 128×128 legible;
- versiones históricas.

## Primera tarea

La recuperación e integración ya terminaron. Sigue la nueva tarea de código que
indique el usuario, manteniendo `VW-SYS 0.9.1` como candidato,
`VW-SYS 0.9.0` como fallback y `VW-BIO 0.6.0` como perfil científico separado.
No promociones BIO dentro de SYS sin dataset/replay y regresión física.
