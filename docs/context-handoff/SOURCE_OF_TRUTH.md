# VITALWATCH — SOURCE OF TRUTH

## Regla de prioridad

Cuando haya contradicciones, usar este orden:

1. código presente en el árbol de trabajo;
2. resultados de pruebas ejecutadas sobre ese mismo contenido;
3. evidencia física proporcionada por el usuario;
4. documentación existente;
5. hipótesis o recuerdos del chat.

No corregir contradicciones “por intuición”. Registrarlas como
`CONTEXT CONFLICT` y pedir o producir evidencia.

## Baseline disponible

| Concepto | Fuente vigente | Estado | Evidencia |
| --- | --- | --- | --- |
| Firmware estable | `D:\vitalwatch-mobile\esp32\VitalWatch_FW_0_9_0\` | `PARTIALLY_WORKING` | F, U |
| Firmware candidato | `D:\vitalwatch-mobile\esp32\VitalWatch_FW_0_9_1\` | compila; `NOT_TESTED` en hardware | F, U |
| Perfil biomédico | `D:\vitalwatch-mobile\esp32\VitalWatch_BIO_0_6_0\` | compila normal/research/replay; hardware pendiente | F, P |
| Versión candidata declarada | `VitalWatchConfig::VERSION_FIRMWARE = "0.9.1"` | `WORKING` en fuente | F |
| App recuperada | snapshot externo con `watch.tsx` y `virtual-tft.tsx` | `PARTIALLY_WORKING` | F, U |
| Backend recuperado | Edge Functions + migración `scheduled_date` | `PARTIALLY_WORKING` | F, U |
| Automatización firmware estable | acciones `stable-*` de `scripts/esp32-firmware.ps1` | `WORKING` | F |

## Fuente recuperada de `0.9.1`

El usuario entregó la fuente completa en:

```text
C:\Users\Usuario\Downloads\VitalWatch_APP_1.0.3_FW_0.9.1_PARA_OTRA_PC\
```

Contiene:

- `esp32/VitalWatch_FW_0_9_1/` completo;
- `app/(tabs)/watch.tsx`;
- `components/virtual-tft.tsx`;
- `supabase/migrations/20260831151703_add_medication_schedule_date.sql`;
- `.env.example` y `ESTADO_PROYECTO.md`;
- el resto del snapshot app 1.0.3/backend/scripts.

Esta carpeta coincide con la recuperación temporal auditada anteriormente — F.
Los 154 archivos que también existen en `D:\vitalwatch-mobile` coinciden en
contenido; la fuente entregada agrega exactamente 18 rutas faltantes — F.

La carpeta de firmware 0.9.1 fue integrada al workspace sin sobrescribir 0.9.0
y conserva los hashes de la fuente externa salvo las etiquetas explícitas
`VW-SYS`. Esto demuestra presencia y compilación, no prueba física.

## Distinción entre “probado” y “árbol actual”

El usuario y la documentación confirman una prueba física satisfactoria de
`0.9.0`. Git muestra cambios sin commit en:

- `esp32/VitalWatch_FW_0_9_0/Interfaz.h`;
- `esp32/VitalWatch_FW_0_9_0/Sincronizacion_Medicacion.h`.

La comparación contra un clon limpio y el ZIP histórico demostró que los 13
archivos del `0.9.0` actual coinciden con el commit
`49df2d5819e934e1550dc96148c3cfff948a42c2` — F. Los dos archivos aparecen
modificados solo porque el `HEAD` remoto posterior cambió la carpeta estable.

Definición correcta:

- “fuente actual de 0.9.0” — reproducible contra `49df2d5` — F;
- “revisión 0.9.0 físicamente probada” — `WORKING — U`;
- “0.9.1 candidato” — fuente recuperada, compilación histórica informada — U;
- “0.9.1 probado físicamente” — `NOT_TESTED — P`.

## Firmware estable y candidato

```text
esp32/VitalWatch_FW_0_9_0/
├── VitalWatch_FW_0_9_0.ino
├── Configuracion.h
├── Botones.h
├── Sensor_Movimiento.h
├── Sensor_Oxigeno.h
├── Configuracion_WiFi.h
├── Control_Remoto.h
├── Sincronizacion_Medicacion.h
├── Interfaz.h
├── Telemetria.h
├── LogoVitalWatch.h
├── vitalwatch_config.example.h
└── README.md
```

El archivo privado `vitalwatch_config.h` puede existir localmente, pero está
ignorado. Nunca debe copiarse al paquete, mostrarse ni publicarse.

`0.9.1` conserva los mismos módulos y algoritmos. Sus diferencias funcionales
respecto del estable `0.9.0` son:

- versión declarada `0.9.1`;
- medicamentos cada 5 s;
- control TFT cada 1 s;
- fecha `YYYY-MM-DD` almacenada y dibujada como `DD/MM/YYYY`.

Los sensores, GPIO, buses, librerías y política de concurrencia no cambian.

## Archivos históricos

| Ruta | Clasificación | Uso permitido |
| --- | --- | --- |
| `esp32/VitalWatch_FW_0_5_0/` | `DEPRECATED` | baseline original y comparación |
| `esp32/VitalWatch_FW_0_6_0/` | `DEPRECATED` | referencia de primera medicación |
| `esp32/VitalWatch_FW_0_7_0/` | `DEPRECATED` | referencia de telemetría |
| `esp32/VitalWatch_FW_0_8_0/` | `DEPRECATED` | referencia de portal WiFi/NVS |
| `esp32/tft_test/` | `REFERENCE_ONLY` | diagnóstico mínimo de TFT |
| `esp32/vitalwatch_medications/` | `DEPRECATED` | prototipo temprano aislado |
| `supabase/migrations_legacy_local/` | `REFERENCE_ONLY` | comparación histórica; no mezclar automáticamente |

`REFERENCE_ONLY` es una descripción de uso, no una nueva etiqueta de evidencia.

## Archivos recuperados y estado de integración

| Referencia | Quién la usa | Consecuencia |
| --- | --- | --- |
| `esp32/VitalWatch_FW_0_9_1/` | workspace | integrado y compilado; falta hardware |
| `esp32/VitalWatch_BIO_0_6_0/` | Biomedical/Firmware Lab | separado, corregido y compilado; falta hardware/dataset |
| `app/(tabs)/watch.tsx` | fuente entregada | requiere también `components/virtual-tft.tsx` |
| `components/virtual-tft.tsx` | fuente entregada | componente de la Pulsera virtual |
| `supabase/migrations/20260831151703_add_medication_schedule_date.sql` | fuente entregada y commit remoto `64577e2` | restaurar sin inventar SQL |
| `.env.example` y `ESTADO_PROYECTO.md` | fuente entregada | restaurar sin valores privados |

## Estado Git

`git status` funciona y mostró la rama `main` con cambios locales sin commit.
En la auditoría había 20 archivos versionados modificados o eliminados.

`git log` y `git diff` fallan porque faltan objetos internos, por ejemplo:

```text
Could not read 4b15500f0cfa5cc861527f5fc2c15dc468c061af
Failed to traverse parents of commit 64577e2f01412ca963c803f3a15fe63d786e2dc6
```

No ejecutar `git reset`, `git checkout --`, limpieza ni reparación destructiva
sobre esta carpeta. Crear primero una copia verificable.

## Secretos y archivos privados

No leer valores en voz alta, no copiar a documentación y no publicar:

- `.env.local`;
- `.env.simulator.local`;
- `PAIRING_CODE.local.txt`;
- cualquier `esp32/**/vitalwatch_config.h`;
- secretos de Edge Functions;
- tokens de Supabase/Expo;
- contraseñas WiFi.

La URL y clave publicable utilizadas por la app tampoco deben confundirse con
una clave secreta de servicio.

## Comandos válidos según cada ubicación

App, comprobados el 2026-09-01:

```powershell
npm run lint
npx tsc --noEmit
```

Ambos terminaron con código 0 — `F`.

En `D:\vitalwatch-mobile` existen y compilan las rutas estable, candidata y BIO:

```powershell
npm run firmware:stable:build
npm run firmware:build
npm run firmware:bio:build
npm run firmware:bio:research
npm run firmware:bio:replay
```

No ejecutar `firmware:upload`, despliegues o tests que escriban en servicios sin
la autorización específica y el hardware/configuración correspondiente.

En el snapshot externo, TypeScript completo y ESLint de `watch.tsx` y
`virtual-tft.tsx` terminaron con código 0 — F. No se ejecutó build/upload de
firmware durante la recuperación inicial. En la integración posterior pasaron
los builds de `VW-SYS 0.9.1` y `VW-BIO 0.6.0`; no se hizo upload ni prueba física.

## Huellas de recuperación

```text
VitalWatch_FW_0_9_1.ino  58AC95D2153DD906A473373CCFAA19343C36F252B4014FEE17D78CD8EC9EF701
Configuracion.h          531893D22F3B6A0A80B770156A660423EA1A2A7779502379751FC8721C42047C
Interfaz.h               D62F35C31C9FC454E8AB46CCE44704BF7A7B898169A6841CA98E232857ECDCE1
Sincronizacion...h       184CBA3B5A57A6665962ED01C889671A1E780F873674BF2D28444BCEAAAA44F9
watch.tsx                29E6B051E51BB8E9FD2564287CAE2D1A20836D1CECC69779C32C947A5F10789F
virtual-tft.tsx          114453C3002D70B4B6FF58B6011F876A62924F67002A941EAA63D43EA94F217F
```
