# VitalWatch Mobile 1.0.9 (candidata)

La app incluye una **Pulsera virtual** que reproduce el menu de la TFT 128x128
desde el celular. Sus botones responden de forma local e inmediata aunque la
pantalla fisica este apagada. Las tomas de medicacion se guardan en Supabase y
la vista actual puede enviarse al ESP32 de forma explicita. Con BIOSYS 1.0.2,
el botón OK virtual también cierra una alerta de impacto en la TFT y espera la
confirmación real del firmware antes de mostrar el estado normal.

La guia para sincronizar medicamentos entre la app, Supabase y el ESP32 esta en
[`ESP32_MEDICATIONS.md`](ESP32_MEDICATIONS.md).

Aplicacion Expo para visualizar el estado de una pulsera VitalWatch, consultar
telemetria real desde Supabase, administrar medicacion, contactos de confianza y
solicitudes de mensaje/llamada, y recibir alertas locales, push remotas y avisos
automaticos por Telegram.

## Cuenta y vinculacion

La aplicacion usa Supabase Auth. Al abrir una instalacion nueva:

1. Crea una cuenta con correo y contrasena.
2. Confirma el correo si el proyecto de Supabase tiene esa opcion activa.
3. Inicia sesion.
4. Vincula la pulsera con el identificador `VW-001` y su codigo de un solo uso.

La base de datos usa RLS para separar los datos de cada cuenta. El ESP32 se
autentica con una credencial propia y nunca recibe la contrasena del usuario.

## Ejecutar la app

```powershell
npm install
npx expo start
```

La configuracion publica de Supabase se guarda en `.env.local`. Nunca coloques
claves `sb_secret_` en variables
`EXPO_PUBLIC_`.

Consulta [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) para desplegar y
probar las notificaciones Expo, y [TELEGRAM_ALERTS.md](./TELEGRAM_ALERTS.md)
para vincular familiares y probar los avisos externos.

## Estructura principal

- `app/`: pantallas y navegacion con Expo Router.
- `providers/`: estado compartido de VitalWatch.
- `lib/`: acceso a Supabase, almacenamiento y notificaciones.
- `esp32/`: firmware para la pantalla ST7735 y sincronizacion de medicamentos.
- `supabase/migrations/`: cambios reproducibles de base de datos.
- `supabase/functions/`: Edge Functions del backend.

## Verificaciones

```powershell
npm run lint
npx tsc --noEmit
npm run test:readings
npm run test:telegram
npm run test:security
npx expo-doctor
```

## Simulador del ESP32

El simulador guarda lecturas y alertas en Supabase cada 15 segundos. Consulta
[SIMULATOR.md](./SIMULATOR.md) para configurar su clave secreta y ejecutarlo.

## Firmware real

La version probada fisicamente es `VW-BIOSYS 1.0.5`, compuesta por
`VW-SYS 0.9.5 + VW-BIO 0.6.3`. La candidata actual `VW-BIOSYS 1.0.7`
(`VW-SYS 0.9.7 + VW-BIO 0.6.3`) parte de la candidata 1.0.6 y agrega el menu
MENSAJERIA, la descarga minimizada de contactos y solicitudes auditables de
mensaje/llamada. Compila, pero todavia no fue cargada ni probada en la placa.
Consulta [`esp32/VitalWatch_BIOSYS_1_0_7/CAMBIOS_1_0_7.md`](esp32/VitalWatch_BIOSYS_1_0_7/CAMBIOS_1_0_7.md).

SYS conserva TFT, botones, SOS, WiFi,
medicación, control remoto y telemetría; BIO conserva la adquisición y los
algoritmos auditables de MAX30102 e IMU. Las fuentes anteriores permanecen como
líneas base y no fueron sobrescritas.

BIOSYS envía frecuencia cardíaca, SpO2 e impacto reales y registra caídas/SOS.
La batería solo se publica cuando existe un circuito ADC configurado. La app
1.0.9 puede encender, apagar y elegir la vista de la TFT, enviar un OK seguro
para reconocer una alerta activa, administrar contactos y abrir el marcador o
el compositor del sistema operativo desde el detalle autorizado de un evento.
Puede compilarse con:

```powershell
npm run firmware:setup
npm run firmware:biosys:build
npm run firmware:bio:build
```

La corrección de la app, el contrato de sincronización y el orden de despliegue
están documentados en
[`docs/VITALWATCH_APP_1_0_4_BIOSYS_1_0_1.md`](docs/VITALWATCH_APP_1_0_4_BIOSYS_1_0_1.md).

La pantalla de signos en español, el diagnóstico MAX30102, la prioridad de los
botones físicos y la compatibilidad sin nueva APK se documentan en
[`docs/VITALWATCH_BIOSYS_1_0_2_MEDICION_Y_NAVEGACION.md`](docs/VITALWATCH_BIOSYS_1_0_2_MEDICION_Y_NAVEGACION.md).

La decision de versionado, las diferencias de codigo y las compilaciones estan
documentadas en
[`docs/VITALWATCH_INTEGRACION_VW_SYS_0_9_1_VW_BIO_0_6_0.md`](docs/VITALWATCH_INTEGRACION_VW_SYS_0_9_1_VW_BIO_0_6_0.md).

El cableado, la configuracion WiFi y los comandos de carga estan explicados en
[`ESP32_MEDICATIONS.md`](ESP32_MEDICATIONS.md).

El uso del portal WiFi esta explicado paso a paso en
[`WIFI_ESP32.md`](WIFI_ESP32.md).

Para trasladar y probar firmware 0.9.1 en la computadora conectada al ESP32,
consulta [`PROBAR_EN_OTRA_PC.md`](PROBAR_EN_OTRA_PC.md).

El control remoto y sus limites electricos estan explicados en
[`CONTROL_REMOTO_TFT.md`](CONTROL_REMOTO_TFT.md).

El estado actual, las versiones y las proximas mejoras estan resumidos en
[`ESTADO_PROYECTO.md`](ESTADO_PROYECTO.md).
