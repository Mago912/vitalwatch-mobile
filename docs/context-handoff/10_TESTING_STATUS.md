# VITALWATCH — TESTING STATUS

## Regla

`COMPILE_VERIFIED` no significa `HARDWARE_TESTED`. Una prueba anterior tampoco
demuestra que el árbol actual sin commit conserve exactamente el resultado.

## Comprobaciones de la primera pasada — 2026-09-01

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| `git status` antes de editar | ejecutó; 20 cambios versionados | F |
| `npm run lint` | código 0 | F |
| `npx tsc --noEmit` | código 0 | F |
| `git log --oneline -10` | falló por objeto Git ausente | F |
| inventario inicial del workspace | 0.5.0 a 0.9.0; 0.9.1 aún no entregado | F |
| comparación inicial de sensores | iguales 0.5.0–0.9.0 | F |
| firmware build | no ejecutado en tarea documental | P |
| test seguridad | no ejecutado; ruta 0.9.1 todavía no integrada en el workspace | P |

## Comprobaciones de recuperación posteriores — 2026-09-01

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| clon limpio de GitHub | historial completo; `git fsck --full` sin errores | F |
| 0.9.0 actual vs commit `49df2d5` | los 13 archivos coinciden | F |
| fuente externa 0.9.1 | 13 archivos completos; versión interna 0.9.1 | F |
| intervalos 0.9.1 | control 1 s; medicamentos 5 s | F |
| fecha 0.9.1 | parseo y UI `DD/MM/YYYY` presentes | F |
| snapshot recuperado vs workspace | 154 archivos iguales; 18 faltantes recuperados | F |

## Comprobaciones de integración SYS/BIO — 2026-09-01

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| `VW-SYS 0.9.1` integrado | carpeta presente; baseline externo conservado | F |
| build `VW-SYS 0.9.1` | 1.158.620 B flash; 53.536 B RAM; codigo 0 | F |
| entrega BIO original | 351.096 B flash; 26.236 B RAM; codigo 0 | F |
| `VW-BIO 0.6.0` final | 351.384 B flash; 26.260 B RAM; codigo 0 | F |
| BIO research | 353.232 B flash; 30.052 B RAM; codigo 0 | F |
| BIO research + replay | 370.476 B flash; 30.180 B RAM; codigo 0 | F |
| prueba física SYS/BIO | no ejecutada | P |
| dataset/replay real | harness compila; dataset etiquetado no ejecutado | F, P |
| TypeScript del snapshot completo | código 0 | F |
| ESLint `watch.tsx` + `virtual-tft.tsx` | código 0 | F |
| build firmware 0.9.1 actual | no ejecutado por regla de auditoría | P |
| APK 1.0.3 con Pulsera virtual | no ejecutado | P |

## Matriz de firmware y hardware

| Función | Compila | Probado hardware | Resultado | Pendiente |
| --- | --- | --- | --- | --- |
| 0.5.0 original | `COMPILE_VERIFIED — U` | no detallado | baseline conservado | regresión solo si se necesita |
| prueba mínima TFT | `COMPILE_VERIFIED — U` | sí | colores/orientación OK — U | conservar como diagnóstico |
| 0.6.0 medicamentos | `COMPILE_VERIFIED — U` | sí | 84% flash, 16% RAM; ida/vuelta OK — U | histórico |
| 0.7.0 telemetría | `COMPILE_VERIFIED — U` | sí | sensores detectados y primera lectura enviada — U | validar repetidamente |
| 0.8.0 portal WiFi | evidencia documental previa | sí | red 2.4 GHz configurada desde celular — U | reconexión/regresión |
| 0.9.0 revisión probada | evidencia documental previa | sí | marcada estable físicamente — U | conservar binario/fuente exacta |
| 0.9.0 árbol actual | fuente reproducible `49df2d5` — F | prueba anterior U | baseline estable | repetir con hashes |
| 0.9.1 | compilación histórica — U; fuente recuperada — F | no | candidato completo | build + carga + regresión |

La documentación registra para 0.9.1 una compilación de
1,157,364 bytes de flash (88%) y 53,472 bytes de RAM global (16%). Como la
fuente ahora está disponible, pero esa salida todavía no fue reproducida en la
auditoría actual — U.

## Pruebas físicas confirmadas

### TFT

- usuario confirmó “tft ok”;
- menú/medicación visibles;
- medicamento apareció físicamente.

Estado: `WORKING — U` para revisión probada.

### Botones

- múltiples reinicios/carga con BOOT;
- OK largo confirmó medicamento;
- navegación necesaria para prueba de medicamentos.

Estado: `WORKING — U`. El gesto SOS requiere regresión documentada por versión.

### WiFi

- red 2.4 GHz preparada;
- portal/flujo permitió conexión;
- medicamento llegó por Supabase.

Estado: `WORKING — U`. Falta registrar prueba sistemática de reconexión tras
reinicio y cambio de router en el árbol actual.

### Medicamentos

Flujo confirmado:

```text
crear en app → aparece TFT → OK largo → “Tomado” en app
```

Estado: `WORKING — U` para firmware probado.

### MAX30102

- detectado en monitor serie;
- sin dedo/lectura válida se enviaron BPM y SpO₂ nulos.

Hardware: `WORKING — U`.  
Exactitud BPM/SpO₂: `NOT_TESTED` científicamente.

### IMU

- detectada físicamente como MPU6500;
- lectura de reposo aproximada alrededor de 0.95 g en una prueba inicial.

Hardware: `WORKING — U`.  
Detección de caída: `EXPERIMENTAL`, no validada.

### Batería

- el firmware reportó nulo al no existir ADC;
- no hay prueba de porcentaje real.

Comportamiento “no inventar”: `WORKING — U`.  
Medición real: `HARDWARE_NOT_TESTED`.

### SOS y caída

El código y backend implementan ambos eventos. No hay registro suficiente para
atribuir una regresión física completa a la fuente actual 0.9.0.

Estado: `PARTIALLY_WORKING — F, U`; prueba actual `P`.

### Control remoto TFT

0.9.0 contiene implementación y documentación indica que reconoce órdenes con
hasta 30 s. No hay evidencia separada y precisa de cada vista sobre el contenido
actual.

Estado: `PARTIALLY_WORKING — F, U`; regresión de cinco vistas `P`.

## Matriz app/backend

| Función | Validación | Resultado | Estado |
| --- | --- | --- | --- |
| lint app | 2026-09-01 | pasa | `WORKING — F` |
| TypeScript app | 2026-09-01 | pasa | `WORKING — F` |
| Auth | prueba anterior | cuenta/sesión | `WORKING — U` |
| vinculación VW-001 | prueba anterior | vínculo seguro | `WORKING — U` |
| RLS | test seguridad anterior | accesos anónimos bloqueados | `WORKING — U` |
| medicamentos app | física anterior | CRUD/toma | `WORKING — U` |
| historial/datos remotos | prueba anterior | datos visibles | `WORKING — U` |
| notificación local | Android previo | visible | `WORKING — U` |
| push remoto | Android físico | funcionó cerrada | `WORKING — U` |
| app 1.0.3/APK nuevo | no confirmada | pendiente | `NOT_TESTED` |
| pestaña Pulsera | fuente recuperada; TS/ESLint pasan | APK no evaluada | `PARTIALLY_WORKING — F` |
| iOS | pospuesto | sin prueba | `NOT_TESTED` |
| Edge Functions actuales | no lint en esta auditoría | runtime previo | `PARTIALLY_WORKING` |
| migraciones desde cero | archivo recuperado | ejecución no repetida | `PENDING — F` |

## Seguridad previa registrada

La ejecución anterior de `npm run test:security` informó:

- DB sin sesión bloqueada;
- control TFT sin sesión bloqueado;
- pairing sin sesión bloqueado;
- token ESP32 incorrecto bloqueado;
- token correcto aceptado;
- contrato de control TFT válido;
- fecha de medicamentos válida;
- telemetría incorrecta bloqueada;
- registro push sin sesión bloqueado;
- webhook con clave pública bloqueado.

Estado histórico: `WORKING — U`.  
Estado en el workspace: ruta 0.9.1 integrada; test de seguridad `NOT_TESTED`
porque requiere configuración privada, backend y una ejecución autorizada.

## Protocolo mínimo para la próxima regresión

1. Copiar/resguardar árbol y secretos.
2. Partir de la fuente auténtica 0.9.1 ya integrada y registrar hashes finales.
3. Repetir build si cambia codigo y registrar flash/RAM con fecha y hash.
4. Cargar por puerto real, no COM1 Unknown.
5. Guardar log de boot/monitor.
6. Confirmar TFT, botones, sensores y WiFi.
7. Reiniciar sin OK y verificar reconexión.
8. Cambiar WiFi mediante portal.
9. Probar medicamento ida/vuelta.
10. Probar las cinco vistas remotas y confirmación.
11. Probar telemetría válida/nula.
12. Probar SOS y caída de forma controlada.
13. Verificar eventos, historial y push.
14. Repetir después de cualquier cambio biomédico.

## Evidencia que conviene guardar

- hash SHA-256 de archivos fuente;
- salida completa de compilación;
- versión de Arduino CLI/core/librerías;
- puerto y placa;
- log serie sin tokens;
- fotos de cada pantalla sin credenciales;
- timestamps de filas/eventos Supabase;
- versión/build de APK;
- tabla de casos aprobados/fallidos.
