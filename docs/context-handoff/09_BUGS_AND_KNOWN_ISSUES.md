# VITALWATCH — BUGS AND KNOWN ISSUES

Ordenado por riesgo para la continuidad. Las categorías diferencian software,
runtime, hardware, biomédica, UI y energía.

## ISSUE-01 — Fuente `0.9.1` recuperada, integración pendiente

**Categoría:** `COMPILE` / continuidad  
**Problema:** la fuente completa existe en el snapshot entregado, pero todavía no está integrada en `D:\vitalwatch-mobile`.  
**Síntoma:** los comandos genéricos siguen sin encontrar el sketch dentro del workspace.  
**Causa conocida:** el proyecto completo quedó en una copia externa y el repositorio local está dañado.  
**Evidencia:** 13 archivos firmware, versión interna 0.9.1 y hashes registrados — F.  
**Archivos afectados:** `package.json`, scripts ESP32, prueba de seguridad, docs, `constants/vitalwatch.ts`.  
**Prioridad:** `HIGH`  
**Estado:** fuente confirmada — F; integración `PENDING`.  
**Acción recomendada:** preservar la copia e integrarla en un clon limpio, sin reconstruirla de memoria — R.

## ISSUE-02 — Historial Git incompleto/corrupto

**Categoría:** `UNKNOWN` / continuidad  
**Problema:** faltan objetos Git.  
**Síntoma:** `git log` y `git diff` fallan al recorrer padres/objetos.  
**Causa conocida:** base de objetos local incompleta — F.  
**Hipótesis:** copia parcial, sincronización interrumpida o corrupción local — H.  
**Archivos afectados:** `.git/` y todo cambio sin commit.  
**Prioridad:** `HIGH`  
**Estado:** `OPEN`  
**Acción recomendada:** copiar la carpeta completa y luego comparar con un clon limpio o backup. No usar reset/clean — R.

## ISSUE-03 — Baseline 0.9.0 reproducible; vínculo con prueba física no hasheado

**Categoría:** `RUNTIME`  
**Problema:** no se guardó el hash del binario físicamente probado.  
**Resultado de recuperación:** los 13 archivos 0.9.0 actuales coinciden con el commit `49df2d5` y el ZIP histórico — F.  
**Límite:** la prueba física anterior continúa siendo U porque su binario no fue hasheado.  
**Archivos afectados:** `Interfaz.h`, `Sincronizacion_Medicacion.h`.  
**Prioridad:** `HIGH`  
**Estado:** fuente `WORKING — F`; atribución física `PARTIALLY_WORKING — U`.  
**Acción recomendada:** conservar como estable histórico y repetir build/regresión con hashes — R.

## ISSUE-04 — Migración de fecha recuperada pero no integrada/verificada

**Categoría:** `RUNTIME` / backend  
**Problema:** falta en el workspace, aunque fue recuperada desde snapshot y remoto.  
**Síntoma:** un Supabase nuevo creado desde estas migraciones puede carecer de `scheduled_date`, mientras app y Edge Function lo consultan.  
**Causa conocida:** archivo marcado como eliminado en `git status`; copia auténtica disponible — F.  
**Hipótesis:** la migración está aplicada en el proyecto remoto — U, todavía no verificado.  
**Archivos afectados:** migraciones, `lib/vitalwatch-medications.ts`, Edge Function.  
**Prioridad:** `HIGH`  
**Estado:** fuente `WORKING — F`; integración/despliegue `PENDING`.  
**Acción recomendada:** integrar el SQL recuperado y comparar con Supabase remoto — R.

## ISSUE-05 — Pulsera virtual recuperada pero no integrada

**Categoría:** `UI` / `COMPILE`  
**Problema:** tabs declara `watch`; el workspace no contiene la ruta ni su componente.  
**Síntoma:** navegación puede mostrar ruta faltante o pestaña inútil en runtime.  
**Causa conocida:** `watch.tsx` y `components/virtual-tft.tsx` quedaron en la copia externa — F.  
**Archivos afectados:** ruta, componente, `_layout.tsx`, icon map y README.  
**Prioridad:** `HIGH`  
**Estado:** fuente `PARTIALLY_WORKING — F`; APK `NOT_TESTED`.  
**Acción recomendada:** integrar ambos archivos juntos y probar APK 1.0.3 — R.

## ISSUE-06 — Comandos firmware por defecto rotos

**Categoría:** `COMPILE`  
**Problema:** build/upload/configure/prepare apuntaban a 0.9.1 todavía externo.  
**Síntoma:** resuelto al integrar la carpeta y hacer local la ruta Arduino CLI.  
**Causa conocida:** scripts y carpeta estaban separados entre workspace y snapshot.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** `package.json`, `scripts/esp32-*.ps1`.  
**Prioridad:** `HIGH`  
**Estado:** `RESOLVED` para build — F; upload no ejecutado.  
**Mitigación actual:** `firmware:build` y `firmware:bio:*` compilan dentro del workspace.

## ISSUE-07 — Prueba de seguridad no ejecutable en este árbol

**Categoría:** `RUNTIME` / seguridad  
**Problema:** el script requiere configuración privada 0.9.1.  
**Síntoma:** la ruta ya existe; la prueba sigue requiriendo autorización y backend.  
**Causa conocida:** dependencia legítima de token privado, no ausencia de fuente.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** `scripts/test-vitalwatch-security.mjs`.  
**Prioridad:** `HIGH`  
**Estado:** `OPEN`  
**Mitigación:** existe evidencia de una ejecución previa aprobada, pero no valida el estado actual — U.

## ISSUE-08 — Fecha/sondeo rápido implementados en 0.9.1, no probados físicamente

**Categoría:** `UI` / `RUNTIME`  
**Problema:** la implementación existe, pero falta build y regresión actual.  
**Evidencia:** 0.9.1 guarda fecha, dibuja `DD/MM/YYYY`, consulta medicamentos cada 5 s y control cada 1 s — F.  
**Archivos afectados:** firmware, docs.  
**Prioridad:** `MEDIUM`  
**Estado:** código `WORKING — F`; hardware `NOT_TESTED — P`.

## ISSUE-09 — Confirmación app más corta que latencia 0.9.0

**Categoría:** `UI` / `RUNTIME`  
**Problema:** la app espera alrededor de 6 s, 0.9.0 puede consultar cada 30 s.  
**Síntoma:** mensaje “todavía no confirmó” aunque el cambio ocurra luego.  
**Causa conocida:** la app 1.0.3 está diseñada para 0.9.1; con 0.9.0 persiste la brecha.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** `lib/vitalwatch-device-control.ts`, firmware 0.9.0.  
**Prioridad:** `MEDIUM`  
**Estado:** `PARTIALLY_WORKING`; solución implementada en 0.9.1, prueba pendiente.

## ISSUE-10 — HTTPS sin validación de certificado

**Categoría:** `RUNTIME` / seguridad  
**Problema:** `WiFiClientSecure.setInsecure()`.  
**Síntoma:** TLS cifra, pero el ESP32 no autentica correctamente al servidor.  
**Causa conocida:** simplificación del prototipo.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** `Sincronizacion_Medicacion.h`.  
**Prioridad:** `HIGH` para producto, `MEDIUM` para prototipo controlado  
**Estado:** `OPEN`.

## ISSUE-11 — Clave fija del portal WiFi

**Categoría:** `RUNTIME` / seguridad  
**Problema:** todas las unidades del prototipo comparten la clave del AP.  
**Síntoma:** quien conozca la clave puede entrar al portal mientras esté activo.  
**Causa conocida:** onboarding escolar simplificado.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** `Configuracion_WiFi.h`, documentación.  
**Prioridad:** `MEDIUM`  
**Estado:** `OPEN`.

## ISSUE-12 — BPM y SpO₂ sin validación

**Categoría:** `BIOMEDICAL`  
**Problema:** filtros/umbrales son experimentales.  
**Síntoma:** un valor estable internamente puede no ser preciso.  
**Causa conocida:** no hay protocolo/dataset contra referencia.  
**Hipótesis:** movimiento, perfusión, contacto y alimentación pueden afectar — H.  
**Archivos afectados:** `Sensor_Oxigeno.h`, UI/app.  
**Prioridad:** `HIGH`  
**Estado:** `OPEN`.

## ISSUE-13 — Detección de caída no validada

**Categoría:** `BIOMEDICAL` / `HARDWARE`  
**Problema:** umbrales de impacto no equivalen a algoritmo clínico de caída.  
**Síntoma:** falsos positivos o negativos.  
**Causa conocida:** umbrales de demostración sin dataset.  
**Hipótesis:** orientación, montaje y actividad diaria cambian la señal — H.  
**Archivos afectados:** `Sensor_Movimiento.h`, telemetría, alertas.  
**Prioridad:** `HIGH`  
**Estado:** `OPEN`.

## ISSUE-14 — Sin batería real

**Categoría:** `POWER` / `HARDWARE`  
**Problema:** no hay divisor/ADC confirmado.  
**Síntoma:** firmware envía batería nula y TFT `--%`; la app puede conservar un valor anterior o inicial.  
**Causa conocida:** `PIN_BATERIA_ADC = -1`.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** `Configuracion.h`, `Telemetria.h`, app.  
**Prioridad:** `MEDIUM`  
**Estado:** `OPEN`.

## ISSUE-15 — Backlight no se apaga físicamente

**Categoría:** `POWER` / `HARDWARE`  
**Problema:** LED TFT directo a 3V3.  
**Síntoma:** controlador dormido, luz encendida y consumo mantenido.  
**Causa conocida:** no hay MOSFET/load switch ni GPIO configurado.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** cableado, `Configuracion.h`, `Control_Remoto.h`.  
**Prioridad:** `MEDIUM`  
**Estado:** `OPEN`.

## ISSUE-16 — Cola de red pequeña y sin persistencia

**Categoría:** `RUNTIME`  
**Problema:** cuatro acciones en RAM; no hay almacenamiento offline.  
**Síntoma:** con red lenta puede aparecer “Cola de red ocupada” y perderse una telemetría.  
**Causa conocida:** diseño simple de prototipo.  
**Hipótesis:** eventos urgentes consecutivos y timeouts de 7 s aumentan el riesgo — H.  
**Archivos afectados:** `Sincronizacion_Medicacion.h`, `Telemetria.h`.  
**Prioridad:** `MEDIUM`  
**Estado:** `OPEN`.

## ISSUE-17 — Edge Functions fuera de lint/TypeScript principal

**Categoría:** `COMPILE`  
**Problema:** `tsconfig` y ESLint excluyen `supabase/functions`.  
**Síntoma:** lint/tsc de app pueden pasar aunque una función Edge falle.  
**Causa conocida:** runtimes distintos Deno/Expo.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** configuración TS/ESLint, funciones.  
**Prioridad:** `MEDIUM`  
**Estado:** `OPEN`.

## ISSUE-18 — Documentación raíz inconsistente

**Categoría:** `UI` / continuidad  
**Problema:** documentación y workspace todavía no incorporan la fuente recuperada.  
**Síntoma:** un nuevo desarrollador puede confundir “recuperado externamente” con “integrado”.  
**Causa conocida:** el paquete completo fue entregado después de la primera auditoría.  
**Hipótesis:** ninguna necesaria.  
**Archivos afectados:** README, handoff y guías ESP32.  
**Prioridad:** `MEDIUM`  
**Estado:** contexto actualizado; integración del código `OPEN`.

## ISSUE-19 — iOS pospuesto

**Categoría:** `RUNTIME` / `UI`  
**Problema:** no hay prueba de Auth, UI ni push en iOS.  
**Síntoma:** compatibilidad declarada, pero no demostrada.  
**Causa conocida:** decisión de alcance.  
**Hipótesis:** permisos, tokens y layout pueden diferir — H.  
**Archivos afectados:** app/configuración Expo.  
**Prioridad:** `LOW` en el alcance actual  
**Estado:** `OPEN` / `NOT_TESTED`.

## Problemas resueltos que deben vigilarse

| Problema | Categoría | Estado |
| --- | --- | --- |
| FirebaseApp no inicializado en APK | `RUNTIME` | `RESOLVED — U` |
| lockfile incompatible con EAS | `COMPILE` | `RESOLVED — U` |
| puerto COM1 Unknown | `HARDWARE` | `RESOLVED` mediante protección — F |
| IMU rechazada por ID distinto | `HARDWARE` | `RESOLVED` mediante compatibilidad — F, U |
| WiFi fijo por casa | `RUNTIME` | `RESOLVED` para prototipo — U |
