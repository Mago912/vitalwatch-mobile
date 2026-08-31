# Traspaso de contexto para continuar VitalWatch

Fecha del traspaso: 26 de agosto de 2026.

## Instruccion para el nuevo Codex

Continua este proyecto existente. No lo recrees ni reemplaces su arquitectura.
Primero revisa `git status`, `README.md`, `ESP32_MEDICATIONS.md`,
`INSTALAR_EN_OTRA_PC.md` y este archivo. El arbol puede tener cambios sin commit:
no uses `git reset --hard`, no descartes archivos y no publiques credenciales.

Habla en espanol. El usuario tiene nivel inicial de programacion y este es un
proyecto escolar de secundaria, por lo que las explicaciones y comentarios deben
ser claros, breves y faciles de modificar.

El archivo `AGENTS.md` exige consultar la documentacion exacta de Expo SDK 54
antes de modificar codigo Expo.

## Objetivo del producto

VitalWatch es una pulsera para adultos mayores con ESP32, pantalla TFT ST7735,
MAX30102, sensor de movimiento y tres botones. La app permite que un familiar
vea el estado, reciba alertas y administre medicamentos. No hay Firebase como
base de datos: Supabase es el backend. Firebase/FCM solo participa en las
notificaciones push de Android administradas por Expo.

## Estado actual de la aplicacion

- Expo SDK 54, React Native 0.81.5, Expo Router y TypeScript sencillo.
- Supabase Auth implementado con inicio de sesion y vinculacion de pulsera.
- Proyecto Supabase: `sehuynlvfvgfhelqpbrx`.
- Dispositivo de demostracion: `VW-001`.
- Navegacion principal: Inicio, Historial, Medicacion y Configuracion.
- Inicio muestra frecuencia cardiaca, SpO2, bateria, estado y ultima
  actualizacion. Presion y temperatura fueron eliminadas.
- Quedan botones de simulacion para demostraciones, pero el objetivo final es
  reemplazar los datos simulados por datos reales del ESP32.
- Medicamentos: crear, editar, eliminar, marcar como tomado o pendiente y
  sincronizar con Supabase.
- Historial y lecturas se consultan desde Supabase cuando hay una cuenta y una
  pulsera vinculada.
- AsyncStorage conserva configuracion local y datos auxiliares.
- Las notificaciones locales funcionan.
- Las notificaciones push remotas ya funcionaron en un Android fisico: el
  permiso fue concedido, se registro el token de Expo y llego una notificacion.
- El problema previo de `Default FirebaseApp is not initialized` se corrigio
  agregando la configuracion FCM y reconstruyendo la APK.
- iOS se pospuso para una etapa posterior.

Archivos importantes de la app:

- `providers/auth-provider.tsx`: sesion y vinculacion.
- `providers/vitalwatch-provider.tsx`: estado general y sincronizacion.
- `lib/vitalwatch-api.ts`: lecturas, eventos y dispositivo.
- `lib/vitalwatch-medications.ts`: operaciones de medicamentos.
- `lib/vitalwatch-notifications.ts`: permisos y token Expo.
- `lib/vitalwatch-push.ts`: registro del token remoto.
- `app/(tabs)/medication.tsx`: interfaz editable de medicamentos.
- `app/(tabs)/settings.tsx`: cuenta, pulsera y estado push.
- `google-services.json`: configuracion FCM requerida por el build Android.

## Estado de Supabase

Hay migraciones con Auth, RLS, vinculacion segura, indices, dispositivos,
lecturas, eventos, medicamentos, registros de medicacion y tokens push.

Edge Functions existentes:

- `pair-vitalwatch-device`
- `register-vitalwatch-push`
- `send-vitalwatch-push`
- `vitalwatch-medications`
- `vitalwatch-device-medications`

La arquitectura de push usa Expo, una Edge Function y un Database Webhook. Los
secretos permanecen en Supabase y no deben incorporarse al repositorio.

La prueba `npm run test:security` paso anteriormente:

- Base de datos sin sesion: HTTP 401.
- Vinculacion sin sesion: HTTP 401.
- ESP32 con token incorrecto: HTTP 401.
- ESP32 con token correcto: HTTP 200.
- Telemetria con token incorrecto: HTTP 401.
- Registro push sin sesion: HTTP 401.
- Webhook con clave publica: HTTP 401.

El 31 de agosto de 2026 se desplegaron las migraciones de control TFT y la
Edge Function `vitalwatch-device-medications`. El contrato remoto devuelve
`displayOn` y `displayView`, y la prueba de seguridad vuelve a pasar.

La APK Android `1.0.2` (`versionCode 5`) termino correctamente en EAS Build con
ID `11318e53-544d-4211-b7ae-5826b9d5e615`. Tambien se sincronizo
`package-lock.json` con npm 10.9.8 para evitar el error de `npm ci` en Linux.

## Estado del firmware

El usuario entrego su ultimo firmware y sus librerias en archivos comprimidos.
Ya fueron importados; no es necesario volver a usar los comprimidos originales.

- `esp32/VitalWatch_FW_0_5_0/`: copia conservada del firmware original.
- `esp32/VitalWatch_FW_0_6_0/`: primera integracion de medicamentos.
- `esp32/VitalWatch_FW_0_7_0/`: telemetria real hacia Supabase.
- `esp32/VitalWatch_FW_0_8_0/`: version conservada con portal WiFi.
- `esp32/VitalWatch_FW_0_9_0/`: version actual con control remoto de la TFT.
- `esp32/tft_test/`: prueba minima para la pantalla.
- Arduino CLI y dependencias se gestionan con scripts de PowerShell.

Firmware 0.9.0:

- Conserva el procesamiento continuo del MAX30102.
- Conserva deteccion de movimiento e impacto con MPU compatible.
- Usa la pantalla ST7735 de 1.44 pulgadas, SPI, 128 x 128.
- Tiene menu: Signos, Movimiento, Estado y Medicacion.
- Consulta medicamentos en Supabase cada 30 segundos.
- Izquierda/derecha recorren medicamentos.
- OK corto vuelve al menu.
- OK mantenido marca el medicamento como tomado.
- WiFi/HTTPS se ejecuta en una tarea FreeRTOS separada para no bloquear sensores.
- Envia frecuencia cardiaca, SpO2 e impacto cada 30 segundos.
- Envia caidas y SOS inmediatamente mediante `vitalwatch-device-telemetry`.
- Si no conoce una red, crea `VitalWatch-VW-001` y abre un portal local.
- Guarda WiFi en NVS y se reconecta automaticamente.
- Mantener OK durante el arranque borra la red y vuelve a abrir el portal.
- La app puede encender, apagar y abrir Menu, Signos, Movimiento, Estado o Medicacion.
- El ESP32 confirma en Supabase el estado y la vista realmente aplicados.
- Botones, caidas, SOS y portal WiFi tienen prioridad sobre la orden remota.
- La conexion HTTPS usa temporalmente `setInsecure()`; para produccion se debe
  instalar el certificado raiz correspondiente.

La ultima compilacion integrada paso:

- Flash: 1.157.364 bytes, 88%.
- RAM global: 53.472 bytes, 16%.
- Binario combinado: `.arduino/build/vitalwatch-0.9.0/VitalWatch_FW_0_9_0.ino.merged.bin`.

Tambien compilaron el firmware original y la prueba TFT.

## Hardware y conexiones

Pantalla ST7735 1.44 pulgadas, 128 x 128:

| TFT | ESP32 |
| --- | --- |
| LED | 3V3 |
| SCK | GPIO 18 |
| SDA/MOSI | GPIO 23 |
| A0/DC | GPIO 2 |
| RESET | GPIO 4 |
| CS | GPIO 5 |
| GND | GND |
| VCC | 3V3 |

Botones conectados a GND usando `INPUT_PULLUP`:

| Boton | ESP32 |
| --- | --- |
| Izquierda | GPIO 25 |
| OK | GPIO 26 |
| Derecha | GPIO 27 |

Sensores en el bus I2C compartido:

| Senal | ESP32 |
| --- | --- |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| MAX30102 | Direccion 0x57 |
| MPU | Direccion 0x68 o 0x69 |

## Archivos privados

La carpeta copiada puede contener estos archivos ignorados. No mostrar sus
valores, no subirlos a Git y no reemplazarlos sin revisar:

- `.env.local`
- `.env.simulator.local`
- `supabase/functions/.env.local`
- `esp32/VitalWatch_FW_0_9_0/vitalwatch_config.h`
- `PAIRING_CODE.local.txt`

El WiFi principal ya no necesita estar escrito en ese archivo. Supabase, el
codigo del dispositivo y su token privado siguen siendo obligatorios.

## Punto exacto para continuar

La version 0.9.0 compila y agrega control remoto de la TFT sobre la telemetria y
el portal WiFi existentes, pero todavia necesita una prueba fisica completa en
el ESP32. Las migraciones y la Edge Function nuevas deben desplegarse primero.

Seguir estos pasos:

1. Ejecutar `git status` y conservar todos los cambios existentes.
2. Ejecutar `npm install` si `node_modules` no es valido en la nueva PC.
3. Ejecutar `npm run lint` y `npx tsc --noEmit`.
4. Ejecutar `npm run firmware:setup` para validar Arduino CLI y librerias.
5. Comprobar que `vitalwatch_config.h` tenga Supabase y el token del dispositivo.
6. Conectar el ESP32 con un cable USB de datos.
7. Ejecutar `npm run firmware:ports`. No usar `COM1 Unknown`.
8. Ejecutar `npm run firmware:build` y `npm run firmware:upload`.
9. Mantener OK durante un reinicio para forzar el portal WiFi.
10. Conectar el celular a `VitalWatch-VW-001`, clave `VitalWatch123`.
11. Abrir `http://192.168.4.1`, elegir una red de 2.4 GHz y guardar.
12. Ejecutar `npm run firmware:monitor` y revisar WiFi, sensores y Supabase.
13. Reiniciar sin pulsar OK y comprobar la reconexion automatica.
14. Crear un medicamento, verlo en la TFT y marcarlo como tomado.
15. Confirmar en la app cambios de pulso, SpO2, caida y SOS.

No declarar completa la integracion hasta realizar esa prueba fisica. El paso
siguiente es mejorar la estabilidad y calibracion de pulso/SpO2 con mediciones
reales repetidas, sin presentar el prototipo como un dispositivo medico.

## Comandos de referencia

```powershell
npm install
npm run lint
npx tsc --noEmit
npm run test:security

npm run firmware:setup
npm run firmware:configure
npm run firmware:ports
npm run firmware:tft:build
npm run firmware:tft:upload
npm run firmware:build
npm run firmware:upload
npm run firmware:monitor
```

No realizar un build iOS por ahora salvo que el usuario cambie la prioridad.
