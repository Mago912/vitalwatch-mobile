# Alertas automaticas por Telegram

VitalWatch 1.0.8 usa un bot de Telegram como unico canal externo. Las
notificaciones push de Expo siguen activas en los celulares que tienen la app.

## 1. Crear el bot

1. Abrir `@BotFather` en Telegram.
2. Enviar `/newbot` y elegir nombre y usuario.
3. Guardar el token en un lugar privado. Nunca copiarlo al repositorio.

## 2. Configurar Supabase y el webhook

Desde la raiz del proyecto ejecutar:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/configure-telegram-webhook.ps1
```

El asistente pide solamente el token en modo oculto. Luego comprueba el bot,
detecta su usuario, genera un secreto aleatorio, guarda los tres secretos en
Supabase y configura el webhook. No escribe el token en archivos.

Los secretos de Twilio fueron retirados despues de validar Telegram.

## 3. Desplegar codigo actualizado

```powershell
npx supabase db push --linked
npx supabase functions deploy create-telegram-link --use-api
npx supabase functions deploy telegram-vitalwatch-bot --use-api
npx supabase functions deploy send-vitalwatch-push --use-api
npx supabase functions deploy vitalwatch-device-telemetry --use-api
```

## 4. Vincular a un familiar

1. Abrir Configuracion > Alertas por Telegram.
2. Tocar `Vincular un familiar`.
3. Tocar `Abrir y vincular en Telegram` y luego `INICIAR`.
4. Como alternativa, enviar `/vincular CODIGO` manualmente.
5. Esperar la confirmacion del bot y comprobar que el chat aparece en la app.

El codigo dura 10 minutos y solo sirve una vez. Cada familiar repite estos
pasos con su propio Telegram. La confirmacion incluye el estado actual de la
pulsera y la hora de su ultima comunicacion.

## Alertas enviadas

- caida confirmada despues de la cuenta regresiva;
- SOS;
- tres lecturas consecutivas de frecuencia cardiaca fuera del rango de prueba;
- tres lecturas consecutivas de SpO2 bajo el rango de prueba;
- pulsera sin comunicacion.

Los umbrales son experimentales y no equivalen a un diagnostico medico.
