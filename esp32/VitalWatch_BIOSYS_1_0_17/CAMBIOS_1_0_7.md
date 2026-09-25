# Cambios de VitalWatch BIOSYS 1.0.7

Estado: **CANDIDATE FOR REVIEW**. No reemplaza a BIOSYS 1.0.5 como referencia
fisicamente probada.

## VW-MSG-01 — Mensajeria primero

- Se agrego `MENSAJERIA` como primera de cinco opciones del menu principal.
- Se preservaron Signos, Movimiento, Estado y Medicacion.
- No se cambiaron GPIO, botones, sensores ni temporizaciones biomedicas.

## VW-MSG-02 — Contactos minimizados

- Nuevo modulo `Mensajeria.h`.
- El ESP32 recibe como maximo ocho pares `id + displayName`.
- El numero telefonico permanece en Supabase/app.
- La sincronizacion comparte la tarea de red existente para no bloquear el
  bucle donde se atienden MAX30102 y MPU.

## VW-MSG-03/VW-MSG-04 — Solicitudes y pantalla

- Flujo: Mensajeria → Mensaje/Llamada → Contacto → Confirmacion.
- La Edge Function acepta `MESSAGE_REQUEST` y `CALL_REQUEST` con clave
  idempotente.
- La TFT muestra `PENDIENTE`, `ACEPTADO` o `ERROR DE RED`; nunca afirma que el
  mensaje o la llamada ya se realizaron.
- Las solicitudes pendientes tienen reintento en RAM. Si el ESP32 se reinicia
  antes de recibir confirmacion, una solicitud no critica pendiente puede
  perderse; esta limitacion queda documentada para una revision futura.

## Versiones incluidas

- Producto: BIOSYS 1.0.7.
- Sistema: SYS 0.9.7.
- Biomedico preservado: BIO 0.6.3.
- App compatible: 1.0.9.
