# VITALWATCH — PENDING WORK

# CRITICAL

## C-01 — Preservar el estado actual

Área: `Firmware`, `Testing`, continuidad.  
Estado: `PENDING — F`.

1. Copiar la carpeta completa a almacenamiento seguro.
2. Guardar aparte archivos privados sin mostrarlos.
3. Registrar hashes de fuentes actuales.
4. No ejecutar reset, clean ni sobrescritura.

## C-02 — Integrar la fuente de verdad recuperada

Área: `Firmware`, `Communication`.  
Estado: `PENDING — F`.

- conservar la fuente entregada y sus hashes;
- crear un clon limpio desde el remoto sin destruir el árbol actual;
- integrar `VitalWatch_FW_0_9_1` y los archivos relacionados;
- registrar un commit reproducible que separe 0.9.0 estable y 0.9.1 candidato.

## C-03 — Integrar archivos recuperados relacionados

Área: `Firmware`, app, backend.  
Estado: `PENDING — F`.

- migración auténtica `add_medication_schedule_date.sql`;
- `app/(tabs)/watch.tsx` y `components/virtual-tft.tsx`;
- `.env.example` sin valores secretos;
- `ESTADO_PROYECTO.md`;
- scripts/documentación coherentes con la versión elegida.

Todos fueron localizados en la fuente entregada — F. No reimplementarlos ni
copiarlos de otras versiones.

# HIGH

## H-01 — Compilar el baseline elegido

Área: `Firmware`, `Testing`.

- ejecutar setup de toolchain;
- usar ruta explícita que exista;
- registrar versiones, flash, RAM y hashes;
- no cargar todavía si la compilación revela incoherencias.

## H-02 — Regresión física completa

Área: `Hardware`, `Testing`, `Communication`.

- TFT y botones;
- IMU/MAX30102;
- portal, red 2.4 GHz y reconexión;
- medicamentos ida/vuelta;
- cinco vistas remotas y encendido lógico;
- telemetría periódica;
- caída/SOS y notificaciones;
- reinicios y pérdida de red.

## H-03 — Restaurar reproducibilidad de Supabase

Área: `Communication`, backend.

- comparar migraciones locales con proyecto remoto;
- integrar `scheduled_date` original y verificar si ya está desplegado;
- comprobar funciones desplegadas y sus nombres;
- ejecutar pruebas de seguridad sin exponer tokens;
- agregar validación propia de Edge Functions.

## H-04 — Validación biomédica básica

Área: `Biomedical`.

- congelar baseline de sensores;
- definir protocolo y referencia;
- recoger señal/resultado repetido;
- analizar BPM, SpO₂ y falsos impactos;
- cambiar parámetros solo después de resultados.

## H-05 — Cerrar brecha de seguridad TLS

Área: `Communication`.

- evaluar CA raíz/certificate bundle compatible con ESP32;
- probar renovación/caducidad;
- quitar `setInsecure()` solo con conexión estable demostrada.

# MEDIUM

## M-01 — Alinear latencia del control TFT

Área: `Firmware`, `UI`, `Communication`.

La solución recuperada en 0.9.1 usa sondeo de control cercano a 1 s y
medicamentos cada 5 s. Pendiente:

- medir latencia real, carga de red y estabilidad de sensores;
- confirmar que la app recibe confirmación dentro de sus 6 s;
- mantener documentada la latencia de 30 s del fallback 0.9.0.

No acelerar a costa de sensores, consumo o límites backend.

## M-02 — Completar fecha en TFT

Área: `Firmware`, `UI`.

- validar la implementación ya presente en 0.9.1;
- revisar espacio 128×128;
- probar medicamentos de distintos días;
- mantener compatibilidad con logs.

## M-03 — Pantalla virtual de la app

Área: app `UI`.

- integrar `watch.tsx` y `virtual-tft.tsx` recuperados;
- mantener botones locales inmediatos;
- enviar vista física solo por acción explícita;
- probar APK 1.0.3.

## M-04 — Hardware de batería

Área: `Power`, `Hardware`.

- definir batería, carga y protección;
- diseñar divisor seguro en ADC1;
- confirmar GPIO disponible;
- calibrar curva/porcentaje;
- validar consumo y precisión.

## M-05 — Control real de backlight

Área: `Power`, `Hardware`.

- elegir MOSFET/load switch;
- medir corriente;
- validar polaridad y GPIO;
- actualizar `PIN_TFT_BACKLIGHT` solo después del circuito.

## M-06 — Robustecer cola/offline

Área: `Firmware`, `Communication`.

- medir pérdida bajo WiFi malo;
- priorizar SOS/caída sobre telemetría periódica;
- considerar reintentos con backoff y persistencia mínima;
- evitar duplicados mediante IDs/idempotencia si se implementa.

## M-07 — UX de fuente de datos

Área: app `UI`.

- aclarar cuándo un valor es remoto, simulado, anterior o nulo;
- corregir subtítulo de Historial;
- evitar mostrar batería inicial como si fuera lectura real;
- mostrar calidad/validez si backend la incorpora.

# LOW

## L-01 — iOS

Área: app, `Testing`.  
Estado: pospuesto.

- credenciales y build;
- permisos/notificaciones;
- iconos SF Symbols;
- prueba de layouts y Auth.

## L-02 — Limpieza del template Expo

Área: app.

Eliminar componentes/modal sin uso solo después de estabilizar rutas. No aporta
valor al bloqueo actual.

## L-03 — Documentación raíz

Área: continuidad.

Cuando se resuelvan los conflictos, actualizar README y guías para que este
paquete deje de ser una excepción documental.

# PENDIENTES POR ÁREA

| Área | Pendientes principales |
| --- | --- |
| Firmware | integrar 0.9.1, compilar y validar latencia/control |
| Biomedical | validar BPM, SpO₂, dedo, calidad e impacto |
| Hardware | verificar montaje, diseñar batería/backlight |
| Power | medir consumo, ADC y ahorro real TFT |
| Testing | regresión versionada con hashes y logs |
| Communication | TLS, reintentos, cola, migraciones y Edge Functions |
| UI | integrar/probar Pulsera, validar fecha TFT y estados nulos/experimentales |

# RECOMMENDED NEXT DEVELOPMENT ORDER

1. Preservar la carpeta actual y secretos.
2. Crear un clon Git limpio sin sobrescribir el árbol dañado.
3. Integrar la fuente recuperada y declarar el baseline reproducible.
4. Integrar migración, Pulsera virtual y scripts coherentes.
5. Pasar lint/TypeScript y validación Edge.
6. Compilar firmware elegido.
7. Ejecutar regresión física completa.
8. Validar latencia de control y fecha implementadas en 0.9.1.
9. Diseñar pruebas biomédicas y recoger datos.
10. Diseñar batería/backlight.
11. Mejorar resiliencia y seguridad.
12. Retomar iOS cuando Android/firmware estén estables.

## Primera tarea recomendada del nuevo chat

La integración no destructiva de `VW-SYS 0.9.1` y la separación
`VW-BIO 0.6.0` ya se completaron y compilaron. Continuar con el cambio que pida
el usuario, manteniendo `VW-SYS 0.9.0` como fallback. Para promover BIO dentro
de SYS, exigir primero dataset/replay y regresión física. No cargar el ESP32 ni
desplegar Supabase salvo solicitud explícita.
