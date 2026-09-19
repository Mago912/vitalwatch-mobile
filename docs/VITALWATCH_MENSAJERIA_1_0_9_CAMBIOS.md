# VitalWatch Mensajeria 1.0.9

Estado: **CANDIDATE FOR REVIEW**. Este delta no promueve una nueva baseline.

## Versiones

- App: 1.0.9 candidata.
- Firmware: BIOSYS 1.0.7 = SYS 0.9.7 + BIO 0.6.3.
- Ultima referencia fisicamente probada: BIOSYS 1.0.5.

## Flujo implementado

```text
ESP32 / MENSAJERIA
  -> MENSAJE o LLAMADA
  -> contacto (solo ID + nombre)
  -> confirmacion
  -> Edge Function autenticada por dispositivo
  -> device_events en Supabase
  -> push generica
  -> sesion y RLS en la app
  -> detalle exacto
  -> marcador o compositor del sistema, si corresponde
```

La pulsera no recibe numeros telefonicos. La pantalla bloqueada no recibe
signos vitales, nombres ni numeros. La app no envia mensajes ni inicia llamadas
automaticamente: abre el flujo permitido por Android o iOS tras una accion del
usuario.

## Identificadores de cambio

- `VW-MSG-01`: MENSAJERIA como primera opcion del menu principal.
- `VW-MSG-02`: sincronizacion minimizada de contactos y solicitudes del ESP32.
- `VW-MSG-03`: integracion en la tarea de red existente.
- `VW-MSG-04`: flujo TFT Mensaje/Llamada/contacto/confirmacion/resultado.
- `VW-APP-01`: CRUD y activacion de contactos propios de VitalWatch.
- `VW-APP-02`: integracion de contactos en el proveedor de estado.
- `VW-APP-03`: rutas internas de contactos y detalle sin alterar la barra.
- `VW-APP-04`: consulta autorizada del detalle y contacto asociado.
- `VW-SUPA-01`: relacion opcional `device_events.contact_id`.
- `VW-SUPA-02`: Edge Function de lista y solicitud para la pulsera.
- `VW-SEC-01`: trigger que impide asociar contactos de otro propietario.
- `VW-SEC-02`: autenticacion del dispositivo e idempotencia.
- `VW-NOTIF-01`: contenido generico en pantalla bloqueada.
- `VW-NOTIF-02`: lista blanca de rutas `/event/<id>`.
- `VW-NOTIF-03`: conservacion del destino durante login/vinculacion.
- `VW-NOTIF-04`: payload push minimo.

## Evidencia ejecutada

- Firmware compilado para ESP32 Dev Module: 1.177.376 bytes de flash (89 %) y
  54.704 bytes de RAM global (16 %).
- Binario: 1.177.520 bytes; SHA-256
  `0E976BC8D2B84B5860708D3AE32C9D91C427CDD577D1977859248703CEBF4B65`.
- `npm run lint`: PASS.
- `npx tsc --noEmit`: PASS.
- `npm run test:security`: PASS, incluidos token incorrecto, contrato minimo y
  `contact_id` manipulado.
- `npm run test:telegram`: 5/5 PASS.
- `npm run test:readings`: 7/7 PASS.
- Export estatico Android e iOS con Expo SDK 54: PASS.
- APK Android interno firmado generado con EAS: App 1.0.9, `versionCode 17`,
  build `e257c85e-effd-4d6a-aaa6-d97312a09789`, 83.967.864 bytes; SHA-256
  `AA8DA3452FDC4FB5908A7DAD6A680F1FB82ED4F6742EACFE3B59081878BC7E2B`.
- Migracion `20260914190000` alineada local/remota: PASS.
- `vitalwatch-device-messaging` y `send-vitalwatch-push`: desplegadas.

## No probado todavia

- Carga y navegacion real de BIOSYS 1.0.7 en el ESP32.
- APK 1.0.9 instalado y probado en un telefono Android real; no habia un
  dispositivo ADB conectado durante esta tarea.
- Build iOS firmado e instalado en un telefono real.
- Push en lock screen y toque con app cerrada en Android e iOS reales.
- Apertura real del marcador/compositor en ambos sistemas.
- Ensayo con dos cuentas reales para aislamiento cruzado.
- Reintento duplicado real de una solicitud, para evitar generar avisos durante
  la validacion automatica.

## Rollback y paquetes

- Respaldo anterior: `docs/rollback/VitalWatch_Mensajeria_1_0_9_before.zip`.
- Fuente Arduino sin credenciales: `docs/VitalWatch_BIOSYS_1_0_7_Arduino.zip`.
- APK Android candidato: `docs/VitalWatch_APP_1.0.9_CANDIDATE_build17.apk`.
- La carpeta BIOSYS 1.0.6 permanece intacta como base inmediata del delta.
- No usar `git reset --hard`: el repositorio tiene objetos faltantes y cambios
  anteriores del usuario.
