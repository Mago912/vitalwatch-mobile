# Instalar VitalWatch en otra computadora

Esta guia permite recuperar en Windows la aplicacion Expo, la conexion con
Supabase y el firmware del ESP32. El codigo viaja por GitHub, pero las claves,
la contrasena WiFi y los tokens privados deben copiarse por separado.

## 1. Antes de dejar la computadora actual

Comprueba que los cambios importantes esten subidos a GitHub:

```powershell
git status
git add .
git commit -m "Integra VitalWatch mobile y firmware ESP32"
git push origin main
```

Antes del `commit`, revisa que `git status` no muestre ninguno de estos archivos
privados:

| Archivo | Contenido |
| --- | --- |
| `.env.local` | URL y clave publicable de Supabase |
| `.env.simulator.local` | Clave secreta usada por el simulador |
| `esp32/VitalWatch_FW_0_9_0/vitalwatch_config.h` | Supabase y token privado del ESP32 |
| `supabase/functions/.env.local` | Token privado de Expo |
| `PAIRING_CODE.local.txt` | Codigo local de vinculacion |

Estos archivos estan ignorados por Git. Copialos en un pendrive seguro o vuelve
a crearlos en la computadora nueva. No los publiques en GitHub ni los envies en
una captura de pantalla.

No hace falta copiar `node_modules`, `.expo`, `.arduino`, `.tools`, `android`,
`ios` ni las carpetas `build`: se generan nuevamente.

## 2. Programas necesarios

Instala:

1. Git para Windows.
2. Node.js 22 o una version superior compatible.
3. Visual Studio Code, si deseas editar el proyecto.
4. Expo Go en el celular para probar la interfaz.
5. El controlador USB de la placa ESP32, normalmente CP210x o CH340.

No es necesario instalar Arduino IDE. El proyecto instala una copia local de
Arduino CLI, el nucleo ESP32 y las librerias requeridas.

## 3. Descargar el proyecto

Abre PowerShell en la carpeta donde quieras guardar VitalWatch:

```powershell
git clone https://github.com/Mago912/vitalwatch-mobile.git
cd vitalwatch-mobile
npm install
```

Comprueba la instalacion:

```powershell
npm run lint
npx tsc --noEmit
npx expo-doctor
```

## 4. Configurar la aplicacion y Supabase

Crea `.env.local` desde el ejemplo:

```powershell
Copy-Item .env.example .env.local
```

Completa estas variables con los datos del proyecto Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=https://sehuynlvfvgfhelqpbrx.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=PEGA_AQUI_LA_CLAVE_PUBLICABLE
```

La aplicacion usa el proyecto Supabase que ya esta desplegado. Para ejecutar la
app no hace falta volver a crear tablas, funciones ni webhooks. Inicia sesion con
el mismo usuario de VitalWatch que utilizabas en el celular anterior.

Solo cuando necesites modificar o volver a desplegar Supabase:

```powershell
npx supabase login
npx supabase link --project-ref sehuynlvfvgfhelqpbrx
npx supabase db push
npx supabase functions deploy send-vitalwatch-push
npx supabase functions deploy vitalwatch-device-medications
```

Los secretos de las Edge Functions permanecen guardados en Supabase y no se
descargan con Git.

## 5. Probar la aplicacion

```powershell
npx expo start --clear
```

La computadora y el celular deben estar en la misma red para usar el codigo QR.
Expo Go sirve para comprobar pantallas y gran parte de la logica. Las
notificaciones push remotas de Android deben probarse con la APK de VitalWatch,
porque necesitan la configuracion nativa de Firebase incluida en el build.

Para crear otra APK inicia sesion en la misma cuenta de Expo:

```powershell
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest build --platform android --profile preview
```

El archivo `google-services.json` debe existir en la raiz del proyecto antes del
build. `app.json` ya contiene el identificador EAS y el paquete Android
`com.vitalwatchmobile`.

## 6. Preparar el firmware del ESP32

Instala Arduino CLI, el nucleo ESP32 y las librerias dentro del proyecto:

```powershell
npm run firmware:setup
```

Opcionalmente configura una red WiFi de respaldo:

```powershell
npm run firmware:configure
```

Tambien puedes colocar directamente la copia privada de
`vitalwatch_config.h` dentro de `esp32/VitalWatch_FW_0_9_0/`. El WiFi principal
se carga desde el portal descrito en `WIFI_ESP32.md`.

Compila antes de conectar la placa:

```powershell
npm run firmware:build
```

Conecta el ESP32 con un cable USB de datos y busca el puerto:

```powershell
npm run firmware:ports
```

No uses `COM1` cuando aparezca como `Unknown`. La placa normalmente aparecera en
otro puerto. Para cargar y revisar el firmware:

```powershell
npm run firmware:upload
npm run firmware:monitor
```

Si hay varias placas conectadas, puedes indicar el puerto:

```powershell
npm run firmware:upload -- -Port COM3
```

## 7. Prueba completa recomendada

1. Abre la APK e inicia sesion.
2. Comprueba que las notificaciones remotas figuren como activas.
3. Vincula el dispositivo `VW-001` si fuera necesario.
4. Crea o modifica un medicamento desde la app.
5. Enciende el ESP32 y espera la sincronizacion WiFi.
6. Recorre los medicamentos con los botones izquierdo y derecho.
7. Mantiene presionado OK para marcar uno como tomado.
8. Confirma que el cambio aparezca en la aplicacion y en el historial.

## 8. Resumen de carpetas

| Ruta | Funcion |
| --- | --- |
| `app/` | Pantallas y navegacion Expo Router |
| `providers/` | Estado global, autenticacion y datos VitalWatch |
| `lib/` | Supabase, notificaciones y medicamentos |
| `supabase/` | Migraciones y Edge Functions |
| `esp32/VitalWatch_FW_0_5_0/` | Firmware original conservado |
| `esp32/VitalWatch_FW_0_9_0/` | Firmware actual con portal WiFi y control remoto TFT |
| `scripts/` | Instalacion, compilacion y pruebas |
