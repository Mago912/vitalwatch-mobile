# Traspaso de contexto para continuar VitalWatch

## Actualizacion 2026-09-14 - Mensajeria, app 1.0.9 y BIOSYS 1.0.7

- Se creo la candidata App 1.0.9 y BIOSYS 1.0.7 = SYS 0.9.7 + BIO 0.6.3.
- BIOSYS agrega MENSAJERIA como primera opcion, seleccion de tipo/contacto,
  confirmacion y cola acotada usando la tarea de red existente.
- El ESP32 recibe solamente ID y nombre visible: los telefonos permanecen en
  Supabase y en la app autenticada.
- Supabase incorpora `device_events.contact_id`, validacion por propietario,
  idempotencia por `source_event_id` y la funcion `vitalwatch-device-messaging`.
- Las notificaciones push son deliberadamente genericas; al tocarlas, la app
  conserva la ruta durante autenticacion/vinculacion y abre el evento exacto.
- La app abre `tel:` o `sms:` solamente despues de una accion del usuario; no
  afirma que una llamada o mensaje se haya enviado.
- Migracion y funciones fueron desplegadas. Pruebas de seguridad, TypeScript,
  lint, Telegram, lecturas y exports estaticos Android/iOS pasaron.
- El APK interno firmado App 1.0.9 (`versionCode 17`) termino en EAS con build
  `e257c85e-effd-4d6a-aaa6-d97312a09789`. La copia local verificada esta en
  `docs/VitalWatch_APP_1.0.9_CANDIDATE_build17.apk` (SHA-256
  `AA8DA3452FDC4FB5908A7DAD6A680F1FB82ED4F6742EACFE3B59081878BC7E2B`).
- BIOSYS 1.0.7 compila en ESP32 Dev Module: 1.177.376 bytes de flash (89 %) y
  54.704 bytes de RAM global (16 %). BIO 0.6.3 y archivos de sensores protegidos
  conservan hashes respecto de BIOSYS 1.0.6.
- No se cargo firmware ni se instalo el APK en hardware. BIOSYS 1.0.5 sigue siendo
  la ultima linea fisicamente probada; 1.0.7 permanece candidata.
- Informe principal: `docs/VitalWatch_Registro_Implementacion_Mensajeria.docx`.

## Actualizacion 2026-09-14 - Telegram, app 1.0.8 y BIOSYS 1.0.6

- La APK 1.0.7 termino en EAS y esta pendiente de instalacion/prueba fisica.
- App fuente 1.0.8: abre Telegram con el codigo incluido y detecta la vinculacion
  al volver a la app, con refresco de respaldo cada 15 segundos.
- Cinco pruebas locales cubren `/start`, `/vincular`, codigos invalidos y el
  estado de conexion enviado al confirmar la vinculacion.
- Twilio y `expo-sms` fueron retirados del flujo activo.
- Supabase prepara alertas Telegram, monitoreo de desconexion y confirmacion de
  FC/SpO2 mediante tres lecturas consecutivas.
- BIOSYS 1.0.6 conserva hasta ocho eventos criticos en NVS y agrega impacto,
  inmovilidad y cuenta regresiva cancelable.
- BIOSYS 1.0.6 compila, pero no fue cargado ni probado fisicamente.
- El bot, los secretos, el webhook, las migraciones y las funciones ya estan
  desplegados. `/start` respondio fisicamente; falta vincular el chat desde la
  APK y probar una alerta real.
- La APK 1.0.8 (`versionCode 15`) esta en EAS con build
  `fafcd215-053a-4b0b-957d-4075c471e5f2`; no declararla lista hasta que termine
  y se pruebe en un telefono real.

## Revision 2026-09-12 - trabajar sobre F:

Ver `docs/REVISION_2026_09_12.md` antes de continuar. El usuario confirma
BIOSYS 1.0.3 instalado y 1.0.4 pendiente. Las correcciones de esta sesion estan
solo en `F:\vitalwatch-mobile`, no en la copia anterior de C:.
La app ya no rellena lecturas remotas ausentes con valores simulados ni muestra
calidad/sensores/version de firmware como si estuvieran confirmados. Se quito
la retencion adicional de Inicio. Arduino usa rutas de la carpeta actual.
La generacion web tambien fue corregida. No hay nueva APK ni carga al ESP32.
Atencion: Git tiene objetos faltantes; preservar los archivos antes de recuperar
el repositorio. Revisar validez del PPG candidato antes de instalar 1.0.4.

### Continuacion 2026-09-13

Se implemento caducidad de telemetria a 75 s, estados Reciente/Demorada/Sin
datos/Sin conexion, bloqueo de refrescos superpuestos y medicamentos cada 30 s.
Se retiro la generacion automatica de signos simulados en cuentas vinculadas.
La candidata BIOSYS 1.0.4 invalida HR/SpO2 retenidos si la medicion o el sensor
dejan de ser validos. Falta prueba fisica; 1.0.3 sigue instalado.

## Actualización 2026-09-02 — BIOSYS 1.0.4 preparada (sin carga)

Se creó `esp32/VitalWatch_BIOSYS_1_0_4/` y su paquete
`docs/VitalWatch_BIOSYS_1_0_4_Arduino.zip`. La salida PPG se publica cada 5 s
con mediana temporal y la app consulta/retiene las tarjetas de Inicio cada 5 s.
Se ejecutaron `npx tsc --noEmit`, `npm run lint`, `firmware:biosys:build` y
`firmware:biosys:research`; no se ejecutó ningún upload ni instalación.
Contactos/alertas quedó documentado, sin implementación, en
`docs/CONTACTOS_ALERTA_PENDIENTE.md`.

## Actualización 2026-09-02 — BIOSYS 1.0.2

La fuente actualmente corregida está en
`esp32/VitalWatch_BIOSYS_1_0_3/` y conserva BIOSYS 1.0.1/1.0.2 como líneas base.
La nueva composición es BIOSYS 1.0.3 + SYS 0.9.3 + BIO 0.6.2; la carga física ya
se realizó por COM3 y el arranque confirmó el MAX30102 (`PART_ID=0x15`). La
prueba inicial mostró `drops=0`, SpO2 experimental válida y FC inestable; la
validación final con dedo quieto y navegación aún debe repetirse.

Correcciones: estados PPG en español, autoganancia precontacto, refresco TFT
parcial, diagnóstico Serial `P`, órdenes remotas de vista consumidas una sola
vez y reporte de navegación física. App 1.0.4 build 9 y backend actual son
compatibles sin recompilación o despliegue. La etiqueta de versión dentro de la
Pulsera virtual permanece en 1.0.1 por ser estática.

Fuente detallada:
`docs/VITALWATCH_BIOSYS_1_0_2_MEDICION_Y_NAVEGACION.md`.

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
- `esp32/VitalWatch_FW_0_9_0/`: version estable probada fisicamente.
- `esp32/VitalWatch_FW_0_9_1/`: candidato actual con control rapido y fecha.
- `esp32/tft_test/`: prueba minima para la pantalla.
- Arduino CLI y dependencias se gestionan con scripts de PowerShell.

Firmware 0.9.1 candidato:

- Conserva el procesamiento continuo del MAX30102.
- Conserva deteccion de movimiento e impacto con MPU compatible.
- Usa la pantalla ST7735 de 1.44 pulgadas, SPI, 128 x 128.
- Tiene menu: Signos, Movimiento, Estado y Medicacion.
- Consulta medicamentos en Supabase cada 5 segundos.
- Consulta las ordenes remotas de la TFT aproximadamente cada segundo.
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
- Binario combinado: `.arduino/build/vitalwatch-0.9.1/VitalWatch_FW_0_9_1.ino.merged.bin`.

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
- `esp32/VitalWatch_FW_0_9_1/vitalwatch_config.h`
- `PAIRING_CODE.local.txt`

El WiFi principal ya no necesita estar escrito en ese archivo. Supabase, el
codigo del dispositivo y su token privado siguen siendo obligatorios.

## Punto exacto para continuar

La version 0.9.0 fue probada fisicamente. La version 0.9.1 compila y agrega
control remoto mas rapido y fecha de medicamentos, pero todavia necesita una
prueba fisica completa en el ESP32. La aplicacion 1.0.3 incluye Pulsera virtual
y tambien debe probarse en un APK nuevo.

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
