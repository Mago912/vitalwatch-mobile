# VitalWatch — separación e integración controlada de versiones

Fecha de cierre técnico: 2026-09-01.

## Decisión ejecutiva

El codigo denominado 0.9.1 y la carpeta enviada como 0.6 **no son el mismo
firmware**.

| Eje | Nombre oficial adoptado | Contenido | Estado |
|---|---|---|---|
| Sistema integral | `VW-SYS 0.9.1` | TFT, WiFi, NVS, HTTPS, Supabase, medicacion, telemetria, SOS, control remoto y sensores heredados | compila; hardware pendiente |
| Biomedical | `VW-BIO 0.6.0` | adquisicion PPG/IMU, timing, FIFO, calidad, HR/SpO2, replay e instrumentacion | compila; hardware/dataset pendientes |

La numeracion ya no debe interpretarse como una unica secuencia. `0.9.1` no es
"mas nuevo" que `0.6.0` en exactitud biomédica: pertenecen a ejes distintos.

## Evidencia de la comparación

La carpeta `VW-SYS 0.9.1` tiene 13 archivos principales y conserva modulos de
red como `Configuracion_WiFi.h`, `Control_Remoto.h`,
`Sincronizacion_Medicacion.h` y `Telemetria.h`. La entrega 0.6 tiene 17 archivos
de codigo, usa `.h/.cpp`, e introduce `BioResearch`, `I2CBusService` y
`SystemState`, pero no contiene la pila conectada.

Los unicos binarios fuente identicos relevantes entre ambas lineas son recursos
o modulos heredados puntuales; por ejemplo, el bitmap del logo es identico. La
arquitectura, el punto de entrada y las responsabilidades son diferentes.

Tambien existe en el historial del repositorio una carpeta
`VitalWatch_FW_0_6_0` que corresponde a una antigua evolucion del firmware de
sistema relacionada con medicacion. No fue borrada ni renombrada: ahora queda
claramente diferenciada del nuevo `VitalWatch_BIO_0_6_0`.

## Fuentes tratadas y prioridad

1. Código actual entregado por el usuario: fuente de verdad para el estado real.
2. Baseline funcional FW 0.5.0: referencia de comportamiento biomédico.
3. Transferencia Biomedical Lab: contrato de cambios autorizados.
4. Auditoría Biomedical/Firmware: hallazgos, restricciones y acceptance.
5. Prompt de integración: proceso, documentación y preservación.

Las instrucciones contenidas en documentos se trataron como especificaciones
del proyecto, no como nuevas solicitudes capaces de ampliar el alcance por si
solas. La autorización efectiva provino del mensaje del usuario.

## Inventario conservado

- Copia original externa de `VW-SYS 0.9.1`: intacta.
- Copia original externa de la entrega 0.6: intacta.
- Baseline reproducible interno de la entrega 0.6: conservado bajo `.arduino`.
- Firmware estable `VW-SYS 0.9.0`: intacto.
- Firmware histórico `VitalWatch_FW_0_6_0`: intacto.
- Configuración privada del dispositivo: copiada sólo a un archivo ignorado por
  Git; no se documentaron ni imprimieron secretos.

## Cambios aplicados a VW-BIO

### Modelo biomédico

- HR y SpO2 son resultados independientes.
- Los valores no disponibles se representan como `NAN` internamente y `--` en
  TFT, no como cero fisiológico.
- Un solo IBI no produce HR `VALID`.
- SpO2 sólo entra al camino de resultado cuando Maxim es válido **y** la calidad
  VitalWatch es aceptable.
- El estimador `110 - 25R` es únicamente un campo de investigación.
- Estados de sesión: espera, estabilización, medición, resultado, baja calidad,
  cancelación, timeout y error.

### Adquisición y timing

- Cada muestra PPG lleva secuencia y timestamp reconstruido.
- Se observan `check()`, `available()`, punteros FIFO, overflow, gaps y pérdidas
  sospechadas.
- Se corrigió una retención infinita: el gap máximo se conserva como métrica,
  pero la validez de una muestra usa el gap de servicio actual.
- Una pérdida sospechada invalida una ventana óptica finita; una vez desplazadas
  las muestras afectadas, el sistema puede recuperar validez.

### Research y replay

- CSV no bloqueante con cola y contador de registros descartados.
- Incluye el esquema mínimo de la auditoría: PPG, detectores de peak, IBI, HR,
  calidad/flags, FIFO, LED, IMU, SpO2 Maxim y candidato research.
- Agrega estado de sesión, pérdidas sospechadas, loop, render e I2C.
- Registra espera de contacto y estabilización, no sólo resultados.
- Replay por Serial acepta datasets guardados y alimenta
  `PPGService::processReplaySample()`, la misma función interna usada por el
  pipeline real.

### UI y arquitectura

- Redibujado completo sólo al cambiar vista; datos dinámicos usan rectángulos.
- Sensores publican datos/eventos y no deciden pantallas.
- El estado muestra `Target VW-SYS 0.9.1` y `Activo VW-BIO 0.6.0` para impedir
  confusión de ejes.
- La alerta dice `POSIBLE IMPACTO`; no se afirma caída confirmada.

## Parámetros preservados

No se cambiaron pines, buses, 100 kHz I2C, timeout 100 ms, configuración
MAX30102 0x70/AVG4/RED+IR/400/411/4096, rangos IMU +/-8 g y +/-500 dps,
DLPF 4, objetivo aproximado 100 Hz, thresholds de contacto/IBI/calidad/impacto,
lockout de impacto ni librerías.

## Compilaciones reproducibles

| Build | Flash | RAM global | Resultado |
|---|---:|---:|---|
| Entrega 0.6 original | 351.096 B (26%) | 26.236 B (8%) | PASS |
| `VW-BIO 0.6.0` normal | 351.384 B (26%) | 26.260 B (8%) | PASS |
| `VW-BIO` research | 353.232 B (26%) | 30.052 B (9%) | PASS |
| `VW-BIO` research + replay | 370.476 B (28%) | 30.180 B (9%) | PASS |
| `VW-SYS 0.9.1` final etiquetado | 1.158.620 B (88%) | 53.536 B (16%) | PASS |

Toolchain: ESP32 Arduino core 3.3.11, SparkFun MAX3010x 1.1.2, Adafruit GFX
1.12.6 y Adafruit ST7735/ST7789 1.11.0.

Huellas SHA-256 de entrega:

| Archivo | SHA-256 |
|---|---|
| `VW-SYS/VitalWatch_FW_0_9_1.ino` | `C06244B96770CEA7EB8356A13927F90A966BEE33D76AECC2486B2140434BF1F4` |
| `VW-SYS/Configuracion.h` | `6C6C9A7687B0AD922BFE7EC3B7C6A406B64A9981EF379E73F3A90AB89E9626F5` |
| `VW-BIO/VitalWatch_BIO_0_6_0.ino` | `21F9440CD7784852EA4AA5D9188A39EDB58E0B82CE306F20E95762F4D4B3C677` |
| `VW-BIO/Configuracion.h` | `225A35762ACD1EC52A4B9E4769BD9CEFD8E0A5DA790C3AAAC40D659ED9B529A5` |
| `VW-BIO/Sensor_Oxigeno.cpp` | `E224066E8FDF1FB7E45088A2D9E3DD00C91C49AF8EF11575B30D30BD7ED5ADD3` |
| `VW-BIO/BioResearch.cpp` | `4FA13D7F922D29CFA3EC25B3E20D9695AC12C3AEBC55B32629A5DE20AF9000CB` |
| `VW-BIO/BioReplay.cpp` | `E6A6AD554472236088885497382403E5AD69908F36DB32B05F656D5A7375076D` |

Comandos:

```powershell
npm run firmware:build
npm run firmware:bio:build
npm run firmware:bio:research
npm run firmware:bio:replay
```

## Conflicto resuelto

`CONFLICT DETECTED`: el prompt proponía 0.6.0 como siguiente version de un
baseline 0.5.0, mientras el proyecto conectado ya usa 0.9.1 y el historial ya
tenía un FW 0.6.0 con otro significado. Usar otra vez "FW 0.6.0" habría creado
colisiones documentales y de carpetas.

Resolución: conservar todas las copias y adoptar familias `VW-SYS` y `VW-BIO`.
No se eligió silenciosamente una numeración sobre otra.

## Qué no se integró y por qué

No se reemplazaron los sensores monolíticos de `VW-SYS 0.9.1` por los servicios
de `VW-BIO 0.6.0`. Aunque el código BIO compila, faltan regresión física y
dataset. Hacer ese merge ahora expondría a regresión funciones estables de red,
medicación, control remoto, SOS y telemetría. La separación permite validar la
capa científica antes de promoverla al sistema.

## Validación pendiente

`HARDWARE_VALIDATION_REQUIRED`:

- boot/splash/TFT real y ausencia de parpadeo;
- botones, incluido held-at-boot;
- detección real MAX30102/MPU y recuperación I2C;
- FIFO, gaps, overflow y pérdida bajo carga;
- 30–60 s por sujeto/condición con referencia externa;
- eventos posibles de impacto sin afirmar caídas;
- CSV sostenido y replay del mismo dataset;
- comparación baseline 0.5.0 vs VW-BIO 0.6.x;
- promoción posterior a VW-SYS sólo si la regresión es aprobada.

## Resultado final

La ambigüedad quedó eliminada, ambas líneas compilan y la rama biomédica es
medible, reproducible y auditable. Aún no se declara validación clínica ni
compatibilidad física completa; esas afirmaciones dependen de hardware y datos.
