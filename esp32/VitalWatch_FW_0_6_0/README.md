# VitalWatch FW 0.6.0

Version integrada de la pulsera VitalWatch. Parte del firmware 0.5.0 y agrega
sincronizacion segura de medicamentos con Supabase.

## Funciones

- ST7735 1.44 pulgadas, 128x128.
- MAX30102 procesado continuamente.
- MPU60xx/65xx leido por registros I2C.
- Deteccion experimental de impacto.
- Tres botones con antirrebote.
- Medicamentos remotos y confirmacion de toma.
- Tarea de red separada del loop de sensores.

## Controles

- Izquierda y derecha: navegar.
- OK corto: entrar o volver.
- OK largo en Medicacion: marcar como tomado.
- OK largo en otras vistas: diagnostico manual de sensores.

## Archivos nuevos

- `Sincronizacion_Medicacion.h`: WiFi, HTTPS, cola de acciones y copia segura de
  medicamentos para la interfaz.
- `vitalwatch_config.example.h`: plantilla sin secretos.
- `vitalwatch_config.h`: configuracion local ignorada por Git.

La Edge Function utilizada es `vitalwatch-device-medications`. El ESP32 envia
`x-device-token`; nunca almacena la contrasena de la cuenta de la app ni una
clave administrativa de Supabase.
