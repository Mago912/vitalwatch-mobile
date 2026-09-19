# Probar VitalWatch 0.9.1 en la otra computadora

Este paquete actualiza una copia que ya tiene una version anterior. No contiene
contrasenas, tokens, `.env.local`, `node_modules`, Arduino CLI ni compilaciones.

## Instalar la actualizacion

1. Cierra Expo, Arduino IDE y el Monitor Serie.
2. Conserva la carpeta anterior como respaldo; no la sobrescribas.
3. Crea una carpeta nueva, por ejemplo `vitalwatch-mobile-1.0.3`.
4. Extrae alli el ZIP.
5. Copia desde la carpeta anterior `.env.local`, `google-services.json` y
   `esp32/VitalWatch_FW_0_9_0/vitalwatch_config.h` si existen.
6. Abre PowerShell dentro de la carpeta nueva.
7. Ejecuta:

```powershell
npm install
npm run firmware:prepare
```

`firmware:prepare` realiza estas tareas:

- conserva un `vitalwatch_config.h` de 0.9.1 si ya existe;
- si falta, copia la configuracion privada de 0.9.0, 0.8.0 o 0.7.0;
- corrige las rutas de Arduino CLI para esa computadora;
- instala o verifica el nucleo ESP32 y sus librerias;
- compila firmware 0.9.1 sin cargar todavia la placa.

El script no muestra la clave WiFi ni el token del dispositivo.

## Cargar el ESP32

Conecta la placa mediante un cable USB de datos:

```powershell
npm run firmware:ports
npm run firmware:upload
npm run firmware:monitor
```

No uses `COM1` si aparece como `Unknown`. Cierra el Monitor Serie antes de volver
a cargar el firmware, porque solamente un programa puede usar el puerto COM.

## Forzar la prueba del portal WiFi

La configuracion migrada de 0.7.0 puede conectarse automaticamente a la red
anterior. Para comprobar especificamente el portal nuevo:

1. Manten presionado el boton OK de la pulsera.
2. Pulsa RESET o vuelve a encender el ESP32.
3. Suelta OK cuando la TFT muestre `CONFIGURAR WIFI`.
4. En el celular, conectate a `VitalWatch-VW-001`.
5. Usa la clave `VitalWatch123`.
6. Abre `http://192.168.4.1` si el portal no aparece solo.
7. Elige una red de 2.4 GHz y guarda su contrasena.
8. Reinicia la pulsera sin tocar OK y comprueba que se reconecte sola.

## Prueba completa

1. Abre la app VitalWatch e inicia sesion.
2. En Medicacion, crea un medicamento de prueba.
3. Espera hasta 5 segundos y comprueba que aparezca en la TFT.
4. Manten OK en Medicacion para marcarlo como tomado.
5. Comprueba en la app que el estado cambie.
6. Coloca correctamente el dedo en el MAX30102 y observa pulso y SpO2.
7. Revisa que la app se actualice aproximadamente cada 30 segundos.
8. Prueba SOS manteniendo izquierda y derecha durante 2.5 segundos.
9. Prueba la deteccion de caida con movimientos controlados, sin golpear la placa.
10. Confirma eventos y notificaciones en la aplicacion.
11. En Configuracion, usa `Control de pantalla` para abrir cada vista de la TFT.
    El cambio deberia verse aproximadamente en 1 o 2 segundos.
12. Comprueba que la app muestre la vista como confirmada despues de la sincronizacion.

Las mediciones son experimentales y no deben interpretarse como diagnostico
medico.
