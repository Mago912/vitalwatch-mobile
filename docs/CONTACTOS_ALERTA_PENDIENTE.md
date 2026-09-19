# Diseño pendiente: contactos y alerta desde VitalWatch

## Alcance de esta entrega

Este documento deja definido el nuevo apartado **Contactos** sin activarlo en
la aplicación ni crear migraciones, funciones Edge, permisos o envíos reales.
No se modificó ningún dato de usuarios y el botón OK existente conserva su
semántica actual.

## Flujo previsto

1. La aplicación administra una lista de contactos autorizados.
2. El reloj recibe únicamente los nombres y un identificador estable; no hace
   falta mostrar el número en la pantalla pública.
3. En la vista Contactos se navega con los botones físicos y se resalta un
   nombre.
4. Al pulsar **OK**, la app confirma el contacto seleccionado y registra una
   solicitud de alerta idempotente.
5. Un servicio de backend entrega la alerta al canal configurado para ese
   contacto y registra `sent`, `failed` o `acknowledged`.

## Modelo de datos propuesto

```text
contacts/{contactId}
  ownerUserId: uuid
  displayName: string (1..80)
  phoneE164: string|null
  pushToken: string|null
  channel: "push" | "sms" | "call"
  enabled: boolean
  createdAt: timestamp
  updatedAt: timestamp

contact_alerts/{alertId}
  ownerUserId: uuid
  contactId: uuid
  source: "watch_ok"
  eventType: "manual_alert"
  status: "pending" | "sent" | "failed" | "acknowledged"
  idempotencyKey: string
  createdAt: timestamp
  deliveredAt: timestamp|null
```

El número debe guardarse en formato E.164 y con políticas RLS que permitan al
propietario leer/escribir sus propios contactos. Nunca debe enviarse desde el
ESP32 una credencial de proveedor de SMS.

## Contrato de interfaz reloj-app

La orden futura puede reutilizar el patrón `commandAt` ya usado para cambiar la
vista, agregando `command = "contact_alert"` y `contactId`. El reloj solo debe
confirmar la selección visual; la app es quien crea la solicitud autenticada.
Una repetición del mismo OK debe ser inocua mediante `idempotencyKey`.

## Decisión de canal aún necesaria

“Enviar una alerta al número” no se puede cumplir solo almacenando un teléfono.
Para SMS o llamada hace falta contratar y configurar un proveedor (por
ejemplo, Twilio u otro aprobado), verificar costos, país y consentimiento. La
opción push requiere que el contacto tenga una cuenta/app vinculada. Esta
decisión debe tomarse antes de implementar.

## Criterios de aceptación para la futura implementación

- Los nombres se cargan desde la app y aparecen en el reloj sin bloquear la
  medición PPG.
- OK sobre un contacto envía una sola alerta y muestra confirmación local.
- Sin red, la app informa `pendiente` y reintenta de forma segura; el reloj no
  queda atrapado en Contactos.
- Un contacto deshabilitado no puede seleccionarse.
- Se audita quién, cuándo y por qué canal se envió la alerta, sin exponer el
  número en logs seriales.
