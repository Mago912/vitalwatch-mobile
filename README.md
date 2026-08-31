# VitalWatch Mobile

La guia para sincronizar medicamentos entre la app, Supabase y el ESP32 esta en
[`ESP32_MEDICATIONS.md`](ESP32_MEDICATIONS.md).

Aplicacion Expo para visualizar el estado de una pulsera VitalWatch, consultar
lecturas simuladas desde Supabase, administrar medicacion y recibir alertas
locales o push remotas en Android e iOS.

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

La configuracion publica de Supabase se guarda en `.env.local` siguiendo
`.env.example`. Nunca coloques claves `sb_secret_` en variables
`EXPO_PUBLIC_`.

Consulta [PUSH_NOTIFICATIONS.md](./PUSH_NOTIFICATIONS.md) para desplegar y
probar la Edge Function y el Database Webhook.

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
npm run test:security
npx expo-doctor
```

## Simulador del ESP32

El simulador guarda lecturas y alertas en Supabase cada 15 segundos. Consulta
[SIMULATOR.md](./SIMULATOR.md) para configurar su clave secreta y ejecutarlo.

## Firmware real

El firmware 0.9.0 integra la pantalla ST7735, MAX30102, MPU, botones,
medicamentos y telemetria segura hacia Supabase. Envia frecuencia cardiaca,
SpO2 e impacto reales; tambien registra caidas y SOS. La bateria solo se envia
cuando existe un circuito ADC configurado, para no inventar porcentajes. Tambien
permite configurar el WiFi desde un celular y recordarlo en el ESP32. La app
tambien puede encender, apagar y elegir la vista mostrada en la TFT. Puede
compilarse con:

```powershell
npm run firmware:setup
npm run firmware:build
```

El cableado, la configuracion WiFi y los comandos de carga estan explicados en
[`ESP32_MEDICATIONS.md`](ESP32_MEDICATIONS.md).

El uso del portal WiFi esta explicado paso a paso en
[`WIFI_ESP32.md`](WIFI_ESP32.md).

Para trasladar y probar firmware 0.9.0 en la computadora conectada al ESP32,
consulta [`PROBAR_EN_OTRA_PC.md`](PROBAR_EN_OTRA_PC.md).

El control remoto y sus limites electricos estan explicados en
[`CONTROL_REMOTO_TFT.md`](CONTROL_REMOTO_TFT.md).
