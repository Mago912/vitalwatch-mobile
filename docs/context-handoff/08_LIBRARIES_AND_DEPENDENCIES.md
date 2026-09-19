# VITALWATCH — LIBRARIES AND DEPENDENCIES

## Toolchain firmware

Versiones fijadas por `scripts/esp32-setup.ps1`:

| Herramienta/librería | Versión | Para qué sirve | Estado | Uso |
| --- | --- | --- | --- | --- |
| Arduino CLI | `1.5.1` | instalar/compilar/cargar | `WORKING` previo | scripts PowerShell |
| ESP32 Arduino core | `3.3.11` | placa, WiFi, FreeRTOS, drivers | `WORKING` previo | todo firmware |
| ArduinoJson | `7.4.3` | requests/responses JSON | `WORKING` | `Sincronizacion_Medicacion.h` |
| Adafruit GFX | `1.12.6` | primitivas gráficas | `WORKING` | `Configuracion.h`, UI |
| Adafruit ST7735/ST7789 | `1.11.0` | controlador TFT | `WORKING` | TFT/UI |
| SparkFun MAX3010x | `1.1.2` | MAX30102, heart rate, SpO₂ | `EXPERIMENTAL` biomédico | `Sensor_Oxigeno.h` |

Los scripts verifican descargas con hash para Arduino CLI y usan instalaciones
locales dentro del proyecto.

## Dependencias incluidas en el core ESP32/Arduino

La versión individual fuera del core es `UNKNOWN`; se resuelven con ESP32 core
`3.3.11`.

| API | Para qué sirve | Archivo |
| --- | --- | --- |
| `Arduino.h` | tipos, GPIO, tiempo | todos los módulos |
| `Wire` | I²C MAX30102/IMU | configuración y sensores |
| `SPI` | bus TFT | configuración/main |
| `WiFi` | estación y access point | WiFi/sincronización |
| `Preferences` | NVS para credenciales WiFi | `Configuracion_WiFi.h` |
| `WebServer` | formulario local | `Configuracion_WiFi.h` |
| `DNSServer` | redirección de portal | `Configuracion_WiFi.h` |
| `HTTPClient` | POST a Edge Functions | sincronización |
| `WiFiClientSecure` | TLS | sincronización |
| FreeRTOS queues/tasks/semaphores | concurrencia | sincronización |

## Algoritmos incluidos con SparkFun

| Archivo/API | Función | Estado |
| --- | --- | --- |
| `MAX30105.h` | acceso al chip | `WORKING` hardware |
| `heartRate.h` | utilidades de latido | `EXPERIMENTAL` |
| `spo2_algorithm.h` | algoritmo Maxim/SparkFun | `EXPERIMENTAL` |

No hay una librería externa para MPU. El firmware usa registros I²C directos.

## App móvil

Versiones de `package.json`:

| Dependencia | Versión declarada | Uso |
| --- | --- | --- |
| Expo | `~54.0.37` | plataforma |
| Expo Router | `~6.0.23` | navegación por archivos |
| React | `19.1.0` | UI |
| React Native | `0.81.5` | runtime móvil |
| TypeScript | `~5.9.2` | tipado estricto |
| Supabase JS | `^2.112.0` | Auth y base de datos |
| AsyncStorage | `2.2.0` | persistencia local |
| Expo Notifications | `~0.32.17` | local/push |
| Expo Constants | `~18.0.14` | versión y EAS project ID |
| React Navigation native | `^7.1.8` | tema/navegación |
| React Navigation bottom tabs | `^7.4.0` | barra de tabs |
| React Native Reanimated | `~4.1.1` | runtime/animación |
| React Native Worklets | `0.5.1` | dependencia de Reanimated |
| Gesture Handler | `~2.28.0` | gestos |
| Safe Area Context | `~5.6.0` | áreas seguras |
| React Native Screens | `~4.16.0` | navegación nativa |
| Expo Haptics | `~15.0.8` | feedback de tabs |
| Expo vector icons | `^15.0.3` | iconos Android/web |
| Expo Symbols | `~1.0.8` | iconos iOS |

El proyecto exige Node `>=22.0.0`. EAS fija Node `22.23.1` en el perfil preview.

Dependencias adicionales del template Expo presentes: `expo-font`,
`expo-image`, `expo-linking`, `expo-splash-screen`, `expo-status-bar`,
`expo-system-ui`, `expo-web-browser`, React DOM y React Native Web.

## Backend Supabase

| Dependencia | Versión/fuente | Uso |
| --- | --- | --- |
| `@supabase/supabase-js` | Deno/npm resuelto por cada función | clientes admin/Auth |
| `@supabase/server` | `1.4.1` en import maps | wrapper de funciones de dispositivo/push |
| `@supabase/functions-js` | JSR `^2` | tipos/runtime Edge |
| PostgreSQL `pgcrypto` | extensión | SHA-256 en migración inicial |
| Expo Push API | servicio externo | entrega push |

Las Edge Functions quedan fuera del `tsconfig` y lint de la app. Necesitan su
propia validación al modificarse.

## PRESERVE UNLESS REQUIRED

- ESP32 core `3.3.11`.
- ArduinoJson `7.4.3`.
- Adafruit GFX `1.12.6`.
- Adafruit ST7735/ST7789 `1.11.0`.
- SparkFun MAX3010x `1.1.2`.
- Expo SDK 54 y sus rangos compatibles.
- React Native `0.81.5` y React `19.1.0`.
- TypeScript estricto.
- estructura del lockfile compatible con Node/npm de EAS.

Cambiar una dependencia solo para resolver un problema demostrado. Registrar:

1. problema;
2. versión anterior/nueva;
3. cambio de API;
4. compilación;
5. prueba física o de app;
6. posibilidad de volver atrás.

## Dependencias y seguridad

- `setInsecure()` está en el firmware, no es una propiedad de la librería.
- Una clave publicable de Supabase no reemplaza el token privado del ESP32.
- Una clave `service_role` nunca debe entrar en la app o firmware.
- `google-services.json` es configuración cliente Android, pero no debe
  confundirse con una cuenta de servicio privada.

## Validación de esta auditoría

Con dependencias ya instaladas:

```text
npm run lint      → código 0
npx tsc --noEmit  → código 0
```

No se ejecutó `npm install`, actualización de paquetes, upload ni despliegue.
Sí se compiló firmware con las dependencias locales fijadas.

La fuente completa 0.9.1 conserva este mismo toolchain y estas mismas
dependencias. El snapshot externo recuperado pasó `tsc --noEmit`; además,
`watch.tsx` y `virtual-tft.tsx` pasaron ESLint sin instalar paquetes nuevos — F.
`VW-SYS 0.9.1` compiló con 1.158.620 B de flash y 53.536 B de RAM global. El
`VW-BIO 0.6.0` final compiló normal (351.384 B/26.260 B), research
(353.232 B/30.052 B) y research+replay (370.476 B/30.180 B). Todas las
compilaciones finalizaron con codigo 0 — F.
