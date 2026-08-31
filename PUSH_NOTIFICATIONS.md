# Notificaciones push remotas de VitalWatch

La app registra el `ExpoPushToken` del celular para una pulsera. Cuando Supabase
inserta una alerta en `public.device_events`, un Database Webhook llama a la
Edge Function `send-vitalwatch-push`, que envia la notificacion mediante Expo.

## 1. Backend de Supabase

La migracion crea `public.push_tokens`. La tabla tiene RLS activado y no puede
leerse desde la app. Solo la Edge Function puede registrar y consultar tokens.

Para aplicar los archivos desde una terminal:

```powershell
npx supabase login
npx supabase link --project-ref sehuynlvfvgfhelqpbrx
npx supabase db push
npx supabase functions deploy send-vitalwatch-push
```

## 2. Database Webhook

En el panel de Supabase abre `Database > Webhooks` y crea uno con estos datos:

- Nombre: `device-events-push`
- Tabla: `public.device_events`
- Evento: `Insert`
- Tipo: `Supabase Edge Functions`
- Funcion: `send-vitalwatch-push`
- Metodo: `POST`
- Header de autenticacion: agrega la clave `Secret` con la opcion del panel

No pegues una clave secreta en el codigo de la app ni en una variable
`EXPO_PUBLIC_`.

## 3. Seguridad mejorada de Expo

Expo permite proteger el envio con un Access Token. Crealo en la configuracion
de tu cuenta de Expo, activa `Enhanced Security for Push Notifications` y usa:

```powershell
Copy-Item supabase/functions/.env.example supabase/functions/.env.local
npx supabase secrets set --env-file supabase/functions/.env.local
```

Completa `EXPO_ACCESS_TOKEN` dentro de `.env.local`. Ese archivo esta ignorado
por Git. La funcion tambien puede trabajar sin el token mientras la seguridad
mejorada de Expo no este activada.

## 4. Credenciales de Android e iOS

Android necesita credenciales FCM V1 cargadas en el proyecto de Expo. iOS
necesita una cuenta Apple Developer y una clave APNs. EAS ayuda a configurarlas:

```powershell
npx eas credentials
npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview
```

En iOS, acepta la configuracion de Push Notifications cuando EAS la solicite.
En Android, sigue el asistente de FCM V1 para el paquete
`com.vitalwatchmobile`.

## 5. Prueba completa

1. Instala el nuevo build en el celular y abre VitalWatch.
2. Acepta el permiso de notificaciones.
3. En `Configuracion`, verifica que aparezca `Activas`.
4. Ejecuta `npm run simulate:device` o inserta una fila en `device_events`.
5. Cierra o deja en segundo plano la app y espera la alerta.

Las push remotas no funcionan en Expo Go para Android desde Expo SDK 53. Para
esta prueba se necesita el APK o un development build. Las notificaciones
locales de los botones simulados siguen funcionando en Expo Go.
