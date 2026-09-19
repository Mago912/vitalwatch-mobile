# VITALWATCH — FILES AND MODULES

## Actualización SYS/BIO — 2026-09-01

- `esp32/VitalWatch_FW_0_9_1/`: `VW-SYS 0.9.1`, integrado y compilado.
- `esp32/VitalWatch_BIO_0_6_0/`: `VW-BIO 0.6.0`, perfil científico separado,
  modular, con research/replay; compila y requiere validación física.
- `esp32/VitalWatch_FW_0_6_0/`: firmware histórico de sistema; no confundir con BIO.

El inventario detallado BIO está en `../VITALWATCH_INTEGRACION_VW_SYS_0_9_1_VW_BIO_0_6_0.md`
y en `../../esp32/VitalWatch_BIO_0_6_0/MODULES.md`.

## Cómo interpretar “Se puede modificar”

- **Sí, con prueba**: puede cambiarse si la tarea lo exige y se ejecuta regresión.
- **Solo con evidencia**: es estable, sensible o biomédico; no tocar por estilo.
- **No publicar**: archivo privado.
- **Histórico**: conservar; no desarrollar allí.
- **Generado**: no editar manualmente.

## Firmware estable `0.9.0`

| Archivo | Responsabilidad | Estado | Dependencias | Se puede modificar |
| --- | --- | --- | --- | --- |
| `VitalWatch_FW_0_9_0.ino` | setup, loop, navegación y alertas | `PARTIALLY_WORKING` | todos los módulos | Sí, con prueba |
| `Configuracion.h` | pines, tiempos, TFT, estados, I²C | `WORKING` | Arduino, Wire, SPI, Adafruit | Solo con evidencia |
| `Botones.h` | GPIO, rebote, pulsaciones y SOS | `WORKING` | Arduino | Solo con evidencia |
| `Sensor_Movimiento.h` | IMU, conversión e impacto | `EXPERIMENTAL` | Wire, Configuración | Solo con evidencia biomédica |
| `Sensor_Oxigeno.h` | MAX30102, BPM, SpO₂ y calidad | `EXPERIMENTAL` | SparkFun MAX3010x | Solo con evidencia biomédica |
| `Configuracion_WiFi.h` | NVS, AP, DNS y portal | `WORKING` | WiFi, Preferences, WebServer, DNSServer | Sí, con prueba |
| `Control_Remoto.h` | sueño/vista TFT y confirmación | `PARTIALLY_WORKING` | Configuración/TFT | Sí, con prueba física |
| `Sincronizacion_Medicacion.h` | tarea de red, medicamentos, transporte | reproducible `49df2d5` | ArduinoJson, HTTP, WiFi/TLS | Sí, con prueba completa |
| `Telemetria.h` | captura y cola de telemetría | `PARTIALLY_WORKING` | sensores, sincronización | Solo con evidencia |
| `Interfaz.h` | todas las pantallas TFT | reproducible `49df2d5` | módulos de estado, Adafruit | Sí, con prueba visual |
| `LogoVitalWatch.h` | bitmaps RGB565 | `WORKING` | Adafruit GFX | Solo si cambia identidad visual |
| `README.md` | instrucciones de la versión | `PARTIALLY_WORKING` | firmware | Sí; corregir tras definir baseline |
| `vitalwatch_config.example.h` | plantilla sin secretos | `WORKING` | macros de configuración | Sí, sin valores reales |
| `vitalwatch_config.h` | credenciales privadas | local/ignorado | instalación específica | No publicar |

## Firmware candidato recuperado `0.9.1`

Fuente: `C:\Users\Usuario\Downloads\VitalWatch_APP_1.0.3_FW_0.9.1_PARA_OTRA_PC\esp32\VitalWatch_FW_0_9_1\`.

Contiene los mismos 13 archivos/módulos que 0.9.0. Preserva sensores, GPIO,
WiFi, telemetría y control remoto; agrega versión 0.9.1, fecha de medicamento,
sincronización cada 5 s y control TFT cada 1 s. Estado: fuente completa — F;
compilación actual y hardware — P.

## Firmware histórico y diagnóstico

| Ruta | Responsabilidad | Estado | Dependencias | Se puede modificar |
| --- | --- | --- | --- | --- |
| `esp32/VitalWatch_FW_0_5_0/` | firmware original | `DEPRECATED` | Arduino y sensores | Histórico |
| `esp32/VitalWatch_FW_0_6_0/` | primera integración medicamentos | `DEPRECATED` | Supabase/ArduinoJson | Histórico |
| `esp32/VitalWatch_FW_0_7_0/` | telemetría inicial | `DEPRECATED` | red + Edge Function | Histórico |
| `esp32/VitalWatch_FW_0_8_0/` | portal WiFi/NVS | `DEPRECATED` | WiFi/WebServer | Histórico |
| `esp32/tft_test/` | prueba mínima TFT | `WORKING` como diagnóstico | Adafruit GFX/ST7735 | Solo para diagnóstico |
| `esp32/vitalwatch_medications/` | prototipo temprano | `DEPRECATED` | WiFi/HTTP/ArduinoJson | Histórico |

Los hashes muestran que `Sensor_Movimiento.h` y `Sensor_Oxigeno.h` son idénticos
desde `0.5.0` hasta `0.9.1`. La evolución funcional ocurrió alrededor de ellos,
no dentro de los algoritmos biomédicos — `F`.

## Aplicación Expo

| Archivo | Responsabilidad | Estado | Dependencias | Se puede modificar |
| --- | --- | --- | --- | --- |
| `app/_layout.tsx` | tema, AuthProvider y rutas protegidas | `WORKING` | Expo Router, auth | Sí, con prueba de navegación |
| `app/(tabs)/_layout.tsx` | tabs y VitalWatchProvider | `PARTIALLY_WORKING` | Expo Router | Sí; la ruta está en la fuente entregada |
| `app/(tabs)/index.tsx` | panel, signos y simulaciones | `WORKING` | provider | Sí, con prueba UI |
| `app/(tabs)/explore.tsx` | historial | `WORKING` | provider | Sí, con prueba UI |
| `app/(tabs)/medication.tsx` | CRUD y estados de medicación | `WORKING` | provider | Solo con regresión completa |
| `app/(tabs)/settings.tsx` | perfil, conexión, push y control TFT | `PARTIALLY_WORKING` | auth/provider | Sí, con prueba app+ESP32 |
| `app/(tabs)/watch.tsx` | pantalla Pulsera virtual | recuperada; no integrada | `VirtualTft`, provider | Integrar junto con su componente |
| `app/sign-in.tsx` | login/registro | `WORKING` | AuthProvider | Solo con prueba Auth |
| `app/pair-device.tsx` | vinculación | `WORKING` | AuthProvider/Edge Function | Solo con prueba RLS |
| `app/modal.tsx` | plantilla modal | `DEPRECATED` o sin uso VitalWatch | Expo Router | Evitar salvo necesidad |

## Estado y acceso a datos de la app

| Archivo | Responsabilidad | Estado | Dependencias | Se puede modificar |
| --- | --- | --- | --- | --- |
| `providers/auth-provider.tsx` | sesión, refresh, vinculación | `WORKING` | Supabase Auth | Solo con prueba de seguridad |
| `providers/vitalwatch-provider.tsx` | estado global, sincronización, simulaciones | `PARTIALLY_WORKING` | todas las librerías VitalWatch | Sí, con regresión amplia |
| `lib/supabase.ts` | cliente y persistencia Auth | `WORKING` | Supabase, AsyncStorage | Solo con prueba Auth |
| `lib/vitalwatch-api.ts` | snapshot dashboard | `WORKING` | tablas Supabase | Sí, con prueba RLS |
| `lib/vitalwatch-medications.ts` | CRUD, logs y fechas | `WORKING` remoto previo | Supabase | Solo con prueba app+TFT |
| `lib/vitalwatch-device-control.ts` | orden y espera de confirmación TFT | `PARTIALLY_WORKING` | Supabase | Sí, con prueba física |
| `lib/vitalwatch-notifications.ts` | permisos, canal, token Expo | `WORKING` Android | Expo Notifications | Solo con APK física |
| `lib/vitalwatch-push.ts` | registro push en Edge Function | `WORKING` Android | Supabase/Auth | Solo con APK física |
| `lib/vitalwatch-storage.ts` | AsyncStorage | `WORKING` | AsyncStorage | Sí, con migración de datos |
| `constants/vitalwatch.ts` | tipos, valores iniciales, versión objetivo | `PARTIALLY_WORKING` | app | Corregir tras definir baseline |
| `constants/theme.ts` | colores del template Expo | `WORKING` | React Navigation | Sí, con prueba visual |
| `components/ui/icon-symbol.tsx` | mapa Material Icons en Android/web | `PARTIALLY_WORKING` | Expo vector icons | Sí; revisar icono Pulsera |
| `components/ui/icon-symbol.ios.tsx` | símbolos SF en iOS | `NOT_TESTED` | expo-symbols | iOS pospuesto |
| `components/haptic-tab.tsx` | respuesta háptica tabs | `WORKING` | Expo Haptics | Sí, con prueba dispositivo |
| `components/virtual-tft.tsx` | emulación visual/controles TFT | recuperada; no integrada | React Native, tipos VitalWatch | Integrar con `watch.tsx` |
| `hooks/use-color-scheme*` | tema del sistema | `WORKING` | React Native | Evitar cambio innecesario |
| componentes de ejemplo Expo | UI auxiliar/template | `DEPRECATED` o no central | Expo/React Native | Eliminar solo en tarea dedicada |

## Supabase

| Archivo/ruta | Responsabilidad | Estado | Dependencias | Se puede modificar |
| --- | --- | --- | --- | --- |
| `supabase/config.toml` | configuración Edge Functions | `WORKING` desplegado previo | Supabase CLI | Solo con despliegue probado |
| `functions/pair-vitalwatch-device/index.ts` | vinculación autenticada | `WORKING` | Admin client/RPC | Solo con prueba seguridad |
| `functions/register-vitalwatch-push/index.ts` | registra token del celular | `WORKING` Android | Auth/service role | Solo con prueba seguridad |
| `functions/send-vitalwatch-push/index.ts` | webhook → Expo push | `WORKING` Android | webhook secret/Expo | Solo con prueba push |
| `functions/vitalwatch-device-medications/index.ts` | token ESP32, meds y control | `WORKING` previo | `@supabase/server` | Solo con prueba física |
| `functions/vitalwatch-device-telemetry/index.ts` | lecturas y eventos | `WORKING` inicial | `@supabase/server` | Solo con prueba telemetría |
| `migrations/20260805...push...sql` | tokens push/RLS | `WORKING` | PostgreSQL | No reordenar |
| `migrations/20260825...sql` | Auth, pairing, RLS, índices | `WORKING` | PostgreSQL/pgcrypto | Solo con revisión seguridad |
| `migrations/20260831...display...sql` | control/vista TFT | `WORKING` desplegado previo | PostgreSQL | Solo con app+firmware |
| migración `...add_medication_schedule_date.sql` | fecha de medicación | recuperada; despliegue por verificar | PostgreSQL | Integrar copia auténtica |
| `migrations_legacy_local/` | copias históricas | `DEPRECATED` para despliegue | PostgreSQL | Histórico |

## Scripts y configuración de proyecto

| Archivo | Responsabilidad | Estado | Se puede modificar |
| --- | --- | --- | --- |
| `package.json` | dependencias y comandos | `PARTIALLY_WORKING` | Sí, tras integrar 0.9.1 recuperado |
| `package-lock.json` | resolución npm | `WORKING` para app | Generado; cambiar con npm compatible |
| `scripts/esp32-setup.ps1` | instala CLI/core/librerías | `WORKING` previo | Solo con versiones verificadas |
| `scripts/esp32-firmware.ps1` | build/upload/ports/monitor | `PARTIALLY_WORKING` | Corregir tras decisión de baseline |
| `scripts/esp32-configure.ps1` | crea config privada | coherente con snapshot completo | P hasta integrar 0.9.1 |
| `scripts/esp32-prepare-other-pc.ps1` | migración e instalación | coherente con snapshot completo | Revisar operaciones al integrar |
| `scripts/test-vitalwatch-security.mjs` | pruebas de acceso/contrato | ruta válida en snapshot completo | Requiere config privada y autorización |
| `scripts/vitalwatch-simulator.mjs` | inserta escenarios simulados | `WORKING` previo | Requiere secreto local; usar con cuidado |
| `app.json` | Expo/Android/EAS | `WORKING` | Solo con nuevo build |
| `eas.json` | build APK preview | `WORKING` previo | Solo con EAS |
| `tsconfig.json` | TypeScript estricto | `WORKING` | Preservar strict |
| `eslint.config.js` | lint Expo | `WORKING` | Preservar sin necesidad |
| `.gitignore` | protege secretos/generados | `WORKING` | No debilitar |

## Documentación raíz

| Archivo | Estado | Observación |
| --- | --- | --- |
| `README.md` | `PARTIALLY_WORKING` | archivos referidos recuperados; integración pendiente |
| `CODEX_HANDOFF.md` | `PARTIALLY_WORKING` | contiene pruebas útiles; actualizar al integrar baseline |
| `ESP32_MEDICATIONS.md` | `PARTIALLY_WORKING` | contenido respaldado por 0.9.1 recuperado; hardware pendiente |
| `WIFI_ESP32.md` | `WORKING` para 0.9.0 | flujo coincide con el código |
| `CONTROL_REMOTO_TFT.md` | `PARTIALLY_WORKING` | 0.9.0 tarda 30 s; 0.9.1 recuperado usa 1 s |
| `PUSH_NOTIFICATIONS.md` | `WORKING` previo Android | iOS no probado |
| `SIMULATOR.md` | `WORKING` previo | requiere secreto local |
| `INSTALAR_EN_OTRA_PC.md` | `PARTIALLY_WORKING` | archivos recuperados; validar desde baseline limpio |
| `PROBAR_EN_OTRA_PC.md` | `PENDING` | fuente disponible, procedimiento aún no revalidado |
| `AGENTS.md` | `WORKING` | exige documentación Expo v54 antes de cambiar app |

## Archivos generados o privados

No usar como fuente principal:

- `node_modules/`, `.expo/`, `dist/`, `.arduino/`, `.tools/`;
- `esp32/**/build/`;
- binarios `.bin`, `.elf`, `.map`;
- archivos locales de entorno/configuración.

Pueden servir como pista de una compilación pasada, pero no reemplazan la
fuente ni una prueba reproducible.

## Duplicados

No se detectaron nombres del tipo `Archivo(1).h` entre las fuentes revisadas.
Sí existen versiones históricas intencionales de los mismos módulos. No son
duplicados accidentales y no deben borrarse.
