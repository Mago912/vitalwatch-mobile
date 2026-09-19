# VitalWatch App 1.0.4 + BIOSYS 1.0.1

## Resultado

Se creó, desplegó e instaló **VitalWatch App 1.0.4** junto con la revisión
compatible del firmware **VW-BIOSYS 1.0.1**, compuesta por **VW-SYS 0.9.2 +
VW-BIO 0.6.0**. La capa biomédica no cambió sus algoritmos ni umbrales.

Esta entrega corrige tres comportamientos:

1. El OK de la pantalla virtual ahora se envía al ESP32 y cierra la alerta de
   impacto en la TFT física.
2. Cuando el aviso desaparece de la TFT por OK físico o remoto, BIOSYS reporta
   `none` y la app deja de mostrar “Caída detectada”.
3. Encendido, apagado y selección de vistas de la TFT pasaron de Configuración
   al apartado Pulsera.

## Causa del error anterior

En la app 1.0.3, el botón OK de la TFT virtual solamente cambiaba el estado de
React en el teléfono. No existía una orden equivalente a pulsar OK en el ESP32.
Además, el firmware protege las alertas críticas frente a órdenes normales de
cambio de vista; por eso enviar “menú” tampoco podía cerrar la alerta.

La app también infería una caída desde el último evento histórico. Un evento de
caída permanece en el historial después de cerrar la pantalla, de modo que no
era una fuente válida para saber si el aviso seguía visible.

## Contrato corregido

La migración `20260902020000_remote_ok_and_alert_state.sql` agrega a `devices`:

| Campo | Emisor | Función |
|---|---|---|
| `desired_input_action` | App | Entrada solicitada; en esta versión solo `ok` |
| `input_command_at` | Base de datos | Identidad temporal de servidor para la orden |
| `input_reported_at` | BIOSYS | Confirma que esa orden fue procesada |
| `reported_alert_state` | BIOSYS | Estado TFT real: `none`, `fall` o `sos` |
| `alert_reported_at` | BIOSYS | Fecha de la última confirmación de alerta |

Flujo del OK remoto:

```text
App pulsa OK
  -> Supabase guarda ok + input_command_at
  -> Edge Function entrega inputAction=ok
  -> BIOSYS consume la orden una sola vez
  -> BIOSYS cierra caída/SOS, vuelve a la vista anterior y redibuja la TFT
  -> BIOSYS reporta input_reported_at + reported_alert_state=none
  -> App muestra Normal únicamente después de esa confirmación
```

El OK remoto no navega pantallas normales. Si llega sin una alerta activa se
confirma, pero no ejecuta una acción ambigua a distancia.

## Estado de caída en la app

La app compara el evento crítico más reciente con el último reporte explícito
de BIOSYS. Un evento nuevo puede activar la alerta; un reporte posterior
`reported_alert_state=none` la cierra aunque el evento continúe en Historial.
Este criterio también funciona si todavía no existe una lectura biométrica.

La actualización remota normal se realiza cada 15 segundos. El OK iniciado en
la app usa una confirmación más rápida: espera hasta 9 segundos, consultando
cada 750 ms. Si BIOSYS está sin WiFi, la app no finge éxito y comunica que falta
la confirmación. Un trigger reemplaza la hora enviada por el teléfono con la
hora del servidor para que un reloj móvil desajustado no repita ni confirme una
orden incorrectamente.

## Cambios de interfaz

- **Pulsera:** TFT virtual, OK de alertas, estado solicitado/confirmado de la
  pantalla, Encender, Apagar, selector de vistas y “Mostrar la vista virtual
  actual”.
- **Configuración:** perfil, identificación/conexión del dispositivo,
  notificaciones, versión instalada y cuenta. Ya no duplica controles TFT.
- **Estado del equipo:** muestra `BIOSYS 1.0.1`, `SYS 0.9.2` y `BIO 0.6.0`.

## Archivos principales modificados

### Aplicación

- `package.json`, `package-lock.json`, `app.json`: versión 1.0.4.
- `app/(tabs)/watch.tsx`: controles físicos concentrados en Pulsera.
- `app/(tabs)/settings.tsx`: retiro de los controles TFT duplicados.
- `components/virtual-tft.tsx`: alerta visual y OK remoto bloqueado durante la
  sincronización.
- `providers/vitalwatch-provider.tsx`: máquina de estado y confirmación remota.
- `lib/vitalwatch-api.ts`: lectura del estado de alerta reportado.
- `lib/vitalwatch-device-control.ts`: emisión y espera confirmada del OK.
- `constants/vitalwatch.ts`: identidad de versiones y tipo de alerta.

### Backend

- `supabase/migrations/20260902020000_remote_ok_and_alert_state.sql`.
- `supabase/functions/vitalwatch-device-medications/index.ts`.
- `scripts/vitalwatch-simulator.mjs`.

### Firmware

- `esp32/VitalWatch_BIOSYS_1_0_1/`: nueva revisión completa; BIOSYS 1.0.0,
  SYS 0.9.1 y BIO 0.6.0 permanecen intactos como líneas base.
- `Control_Remoto.h`: cola/confirmación de OK y estado de alerta.
- `Sincronizacion_Medicacion.h`: intercambio del nuevo contrato.
- `VitalWatch_BIOSYS_1_0_1.ino`: aplicación del OK en el ciclo que controla la
  TFT y reporte inmediato al activar/cerrar alertas.

## Orden obligatorio de despliegue

La app 1.0.4 consulta columnas nuevas. Para evitar errores, desplegar en este
orden:

1. Vincular la CLI al proyecto correcto si aún no está vinculada:
   `npx supabase link --project-ref <PROJECT_REF>`.
2. Aplicar migraciones: `npx supabase db push`.
3. Desplegar la función:
   `npx supabase functions deploy vitalwatch-device-medications`.
4. Compilar/instalar la app 1.0.4.
5. Compilar y cargar BIOSYS 1.0.1 siguiendo
   `esp32/VitalWatch_BIOSYS_1_0_1/VALIDACION_HARDWARE.md`.

## Despliegue efectuado el 2 de septiembre de 2026

- Proyecto Supabase enlazado: `sehuynlvfvgfhelqpbrx` (`Vitalwatch`).
- Historial remoto reconciliado sin marcar migraciones como revertidas. Se
  reconstruyeron localmente, desde el historial remoto y con igualdad exacta de
  sentencias, `20260831151703_add_medication_schedule_date.sql` y
  `20260902013357_remote_alert_acknowledgement.sql`.
- Dry-run final: una sola migración pendiente,
  `20260902020000_remote_ok_and_alert_state.sql`.
- Migración aplicada y verificada: cinco columnas, dos restricciones `CHECK`,
  trigger de hora de servidor y permisos de actualización limitados.
- Edge Function `vitalwatch-device-medications`: versión remota **9**, código
  descargado y comparado con el local; SHA-256 normalizado
  `9AF646A37A391B9097BA4529C0A78179645C61004DD5CFA49638817A63ADD7F4`.
- APK instalada mediante ADB conservando datos: actualización de
  **1.0.3 / versionCode 7** a **1.0.4 / versionCode 9**.
- BIOSYS cargado por USB en ESP32-D0WD-V3 mediante CP210x `COM3`; el cargador
  verificó los hashes y reinició la placa correctamente.
- Arranque serie confirmado:
  `[READY] VitalWatch VW-BIOSYS 1.0.1 | incluye VW-SYS 0.9.2 + VW-BIO 0.6.0`.
- Prueba segura de OK remoto sin alerta: BIOSYS recibió la orden, no navegó ni
  alteró la pantalla normal y Supabase confirmó `input_reported_at >=
  input_command_at`, `acknowledged=true` y `reported_alert_state=none`.
- El primer registro FCM devolvió temporalmente `SERVICE_NOT_AVAILABLE`. Con la
  red Wi-Fi validada y un reinicio limpio de la app, el indicador cambió a
  `Push remotas: Activas`.

## Validación realizada

| Verificación | Resultado |
|---|---|
| ESLint / Expo | PASS |
| TypeScript `tsc --noEmit` | PASS |
| Configuración pública Expo SDK 54 | PASS; app 1.0.4 |
| Sintaxis del simulador Node | PASS |
| Sintaxis del script PowerShell de firmware | PASS |
| Sintaxis TypeScript de Edge Function por transpilación | PASS |
| BIOSYS 1.0.1 producto | PASS; 1.160.984 B flash (88 %), 53.872 B RAM (16 %) |
| BIOSYS 1.0.1 investigación | PASS; 1.162.900 B flash (88 %), 57.664 B RAM (17 %) |
| Migración Supabase y Edge Function v9 | PASS; contenido remoto verificado |
| Seguridad del backend | PASS; 11/11 comprobaciones HTTP |
| APK Android | PASS; 1.0.4 build 9 instalada, proceso activo y sin excepción fatal |
| Carga y arranque físico ESP32 | PASS; COM3, escritura y hash verificados |
| Recorrido OK remoto sin alerta | PASS; orden consumida y acuse remoto confirmado |
| Caída física controlada + cierre visual app/TFT | PENDIENTE; requiere manipulación segura del prototipo |
| Validación clínica | NO REALIZADA |

La prueba visual web quedó bloqueada por una incompatibilidad preexistente del
arranque SSR: AsyncStorage/Supabase intenta acceder a `window` durante la
exportación estática. No afecta las comprobaciones TypeScript/Expo del objetivo
Android, pero debe tratarse por separado si se desea publicar una versión web.

## Prueba física de aceptación

1. Provocar una posible caída de forma controlada; nunca sobre una persona.
2. Confirmar que app y TFT muestran la alerta.
3. Pulsar OK en la app. La app debe indicar espera, la TFT debe volver a la
   vista anterior y luego la app debe mostrar estado normal.
4. Repetir la caída y pulsar OK físico. La TFT debe cerrar inmediatamente y la
   app debe normalizarse en la siguiente sincronización (máximo esperado: unos
   15 segundos con WiFi disponible).
5. Repetir con WiFi desconectado: el OK de la app debe quedar sin confirmación,
   nunca declarar falsamente que la alerta cerró.
6. Verificar desde Pulsera Encender, Apagar y cada vista TFT.
7. Confirmar que Configuración ya no contiene esos controles.

Una compilación correcta no sustituye la validación de hardware ni convierte a
VitalWatch en un dispositivo médico certificado.

## Artefactos entregados

- APK Android firmada:
  `docs/VitalWatch_APP_1.0.4_BIOSYS_1.0.1_build9.apk`; 83.936.692 B,
  SHA-256
  `E5DD3AF0486DFFD646A7B5DCDA6108BE22AA0D46645C5F3FBDD4006D4C427F8A`.
- Compilación EAS:
  `https://expo.dev/accounts/vitalwatch/projects/vitalwatch-mobile/builds/3630793b-c699-49dd-8497-8c499308a265`.
- Fuente Arduino revisable: `esp32/VitalWatch_BIOSYS_1_0_1/`.
- ZIP Arduino sanitizado: `docs/VitalWatch_BIOSYS_1_0_1_Arduino.zip`;
  26 archivos, 65.912 B, SHA-256
  `BA0F305B535CF4FE2CEDBF103ACB312753D640BB73C41F48C09C9AC481CA97C5`.
- Binario local de producto:
  `.arduino/build/biosys-1.0.1/VitalWatch_BIOSYS_1_0_1.ino.bin`;
  SHA-256
  `6E34BB18C25D8C6A8635E741D97DBD6F5C1E368D96CEE392C2003069FDF46B8A`.

El ZIP no contiene `vitalwatch_config.h`, credenciales privadas ni directorios
`build`. Para compilarlo en otra PC se debe copiar
`vitalwatch_config.example.h` como `vitalwatch_config.h` y completar localmente
los valores privados.
