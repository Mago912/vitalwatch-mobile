# Cambios de VitalWatch BIOSYS 1.0.9

## Boton SOS independiente

- Se agrega el boton SOS en `GPIO14`, conectado entre GPIO14 y GND.
- Se usa `INPUT_PULLUP`: reposo en HIGH y pulsacion en LOW.
- Una pulsacion corta y firme activa SOS; no es necesario mantenerlo durante
  2,5 segundos.
- Se conserva antirrebote de 35 ms.
- Se ignoran pulsaciones menores a 300 ms y nuevos avisos durante 5 segundos.
- SOS tiene prioridad sobre una accion de navegacion pendiente.
- La alerta reutiliza el contrato existente: TFT, cola persistente, Supabase,
  push y Telegram.

## Cuenta regresiva de caida

- La cuenta de confirmacion queda en 10 segundos.
- OK puede cancelar durante la cuenta, pero no es necesario para avisar al
  familiar: al llegar a cero se envia `fall_detected` automaticamente.

## Compatibilidad

- No cambia el formato de telemetria ni el tipo `sos` enviado al backend.
- La app no necesita una tabla nueva ni una modificacion para reconocer este
  SOS fisico.
- El resto de la deteccion de caidas y el funcionamiento sin Internet de
  BIOSYS 1.0.8 se conserva.

## Prueba requerida

1. Verificar que el boton una GPIO14 con GND y no con 3V3.
2. Confirmar en Serial: `GPIO14=SOS`.
3. Pulsar y soltar una vez.
4. Verificar la pantalla SOS.
5. Verificar el evento `sos` en `device_events`.
6. Verificar push y Telegram.
