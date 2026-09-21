# VitalWatch App 1.0.12 - Medicacion multihorario

## Cambios

- Un mismo medicamento puede guardarse con varios horarios diarios.
- Cada horario se conserva como una toma independiente para mantener la
  compatibilidad con el ESP32.
- El recordatorio normal se genera al llegar la hora programada.
- Si pasan 15 minutos sin una toma confirmada, Supabase crea una unica alerta
  `medication_missed` y la envia por Telegram.
- Cuando la toma se confirma desde la app o la pulsera, Supabase crea una unica
  alerta `medication_taken` y Telegram informa la confirmacion.

## Componentes desplegados

- Migracion: `20260921193000_medication_overdue_telegram.sql`.
- Edge Function `send-vitalwatch-push`: agrega Telegram para demora y toma.
- Edge Function `vitalwatch-device-medications`: identifica cada confirmacion
  por medicamento y horario para evitar duplicados.

## Prueba recomendada

1. Crear `Metformina` con los horarios `10:00` y `22:00`.
2. Verificar que aparecen dos tarjetas y dos entradas en la pantalla del ESP32.
3. Para una prueba rapida, crear una toma a pocos minutos de la hora actual.
4. Confirmar el recordatorio en la app y en la TFT.
5. La alerta de demora requiere dejar pasar 15 minutos sin marcar la toma.
6. Marcarla como tomada y comprobar el mensaje de confirmacion en Telegram.

La prueba automatizada de Supabase usa una transaccion revertida: valida los
tres eventos sin dejar medicamentos de prueba ni enviar mensajes reales.
