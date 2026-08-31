# VitalWatch FW 0.7.0

Version actual de la pulsera VitalWatch. Parte del firmware 0.6.0 validado
fisicamente y agrega telemetria segura hacia Supabase.

## Funciones

- ST7735 1.44 pulgadas, 128x128.
- MAX30102 procesado continuamente.
- MPU60xx/65xx leido por registros I2C.
- Deteccion experimental de impacto.
- Tres botones con antirrebote.
- Medicamentos remotos y confirmacion de toma.
- Frecuencia cardiaca, SpO2 e impacto enviados cada 30 segundos.
- Eventos de posible caida y SOS enviados inmediatamente.
- Bateria ADC opcional, sin porcentajes inventados cuando falta el circuito.
- Tarea de red separada del loop de sensores.

## Controles

- Izquierda y derecha: navegar.
- OK corto: entrar o volver.
- OK largo en Medicacion: marcar como tomado.
- OK largo en otras vistas: diagnostico manual de sensores.
- Izquierda + derecha durante 2.5 segundos: activar SOS.

## Archivos nuevos

- `Sincronizacion_Medicacion.h`: WiFi, HTTPS, cola de acciones y copia segura de
  medicamentos y telemetria para la tarea de red.
- `Telemetria.h`: captura segura de sensores, bateria opcional, caidas y SOS.
- `vitalwatch_config.example.h`: plantilla sin secretos.
- `vitalwatch_config.h`: configuracion local ignorada por Git.

Las Edge Functions utilizadas son `vitalwatch-device-medications` y
`vitalwatch-device-telemetry`. El ESP32 envia
`x-device-token`; nunca almacena la contrasena de la cuenta de la app ni una
clave administrativa de Supabase.
