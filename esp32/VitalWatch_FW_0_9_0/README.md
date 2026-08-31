# VitalWatch FW 0.9.0

Version actual de la pulsera VitalWatch. Conserva la telemetria segura y la
configuracion WiFi de 0.8.0, y agrega control de la TFT desde la app movil.

## Funciones

- ST7735 de 1.44 pulgadas, 128 x 128.
- MAX30102 procesado continuamente.
- MPU60xx/65xx leido por registros I2C.
- Deteccion experimental de impacto.
- Tres botones con antirrebote.
- Medicamentos remotos y confirmacion de toma.
- Frecuencia cardiaca, SpO2 e impacto enviados cada 30 segundos.
- Eventos de posible caida y SOS enviados inmediatamente.
- Portal cautivo para configurar WiFi desde un celular.
- WiFi guardado en NVS y reconexion automatica.
- Bateria ADC opcional, sin porcentajes inventados.
- Tarea de red separada del loop de sensores.
- Control remoto para encender, apagar y elegir la vista de la TFT.
- Confirmacion en la app del estado y la vista aplicados por el ESP32.

## Control desde la app

La app puede abrir menu, signos vitales, movimiento, estado o medicacion. Los
botones fisicos siguen funcionando y una caida, SOS o configuracion WiFi siempre
tiene prioridad sobre la orden remota.

Si el pin `LED` de la TFT esta conectado directo a `3V3`, dormir el controlador
no apaga la iluminacion. Para ahorrar energia de verdad hace falta un MOSFET o
load switch; `PIN_TFT_BACKLIGHT` queda en `-1` hasta realizar ese cambio.

## Configurar WiFi

Cuando no existe una red guardada, el ESP32 crea:

- red: `VitalWatch-VW-001`;
- clave: `VitalWatch123`;
- portal: `http://192.168.4.1`.

Conecta el celular a esa red, abre el portal y elige el WiFi de 2.4 GHz. La
credencial queda solamente en la memoria del ESP32. Para cambiarla, manten OK
presionado mientras enciendes o reinicias la pulsera.

Consulta la guia completa en `../../WIFI_ESP32.md`.

## Controles

- Izquierda y derecha: navegar.
- OK corto: entrar o volver.
- OK largo en Medicacion: marcar como tomado.
- OK largo en otras vistas: diagnostico manual de sensores.
- Izquierda + derecha durante 2.5 segundos: activar SOS.
- OK durante el encendido: borrar WiFi y abrir el portal.

## Archivos principales

- `Configuracion_WiFi.h`: portal, escaneo, NVS y reconexion.
- `Control_Remoto.h`: cola y aplicacion segura de ordenes para la TFT.
- `Sincronizacion_Medicacion.h`: HTTPS, cola de red y medicamentos.
- `Telemetria.h`: sensores, bateria opcional, caidas y SOS.
- `vitalwatch_config.example.h`: plantilla sin secretos.
- `vitalwatch_config.h`: configuracion local ignorada por Git.

Las Edge Functions utilizadas son `vitalwatch-device-medications` y
`vitalwatch-device-telemetry`. El ESP32 envia `x-device-token`; nunca almacena
la contrasena de la cuenta de la app ni una clave administrativa de Supabase.
