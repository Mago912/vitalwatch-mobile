# Simulador de la pulsera VitalWatch

Este programa representa temporalmente al ESP32. Cada 15 segundos guarda una
lectura en Supabase y recorre situaciones normales, ritmo cardiaco alto,
oxigeno bajo, posible caida y bateria baja.

## Configuracion

1. En Supabase, abre `Project Settings > API Keys`.
2. Busca `Secret keys` y copia una clave que comience con `sb_secret_`.
3. Abre `.env.simulator.local` y pegala despues de `SUPABASE_SECRET_KEY=`.
4. Nunca coloques esa clave en `.env.local` ni en una variable `EXPO_PUBLIC_`.

## Ejecucion

Desde la carpeta del proyecto ejecuta:

```powershell
npm run simulate:device
```

El simulador comienza inmediatamente. Para detenerlo, presiona `Ctrl+C` en la
terminal. La app consulta Supabase cada 15 segundos y muestra la lectura mas
reciente.
