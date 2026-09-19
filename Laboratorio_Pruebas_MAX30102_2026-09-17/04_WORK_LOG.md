# 04 — Historial de trabajo

## 2026-09-17 — Inicio

**Objetivo:** verificar baseline y reconstruir adquisición antes de programar.  
**Archivos analizados:** ZIP baseline, documentos Cowork, `MAX30105.cpp/.h`,
`Sensor_Oxigeno.cpp/.h`, `BioResearch.cpp/.h`, `.ino` principal.  
**Archivos modificados:** sólo documentación nueva del laboratorio en esta fase.  
**Resultado:** hash exacto confirmado; IRR-001–006 localizadas; candidata Cowork
marcada `NOT_AVAILABLE`.  
**Pendientes de esta fase:** pruebas de reproducción y decisiones.

## 2026-09-17 — Reproducción independiente

**Acción:** se crearon y ejecutaron pruebas host nuevas, identificadas como
**CODEX REPRODUCTION TESTS**.  
**Resultado:** IRR-001…IRR-006 `INDEPENDENTLY REPRODUCED`; 15/15 `OK`.  
**Decisión:** `KEEP` para las seis correcciones propuestas. No se utilizó
`FINAL_BIOMED_CANDIDATE`.

## 2026-09-17 — Implementación experimental

**Driver:** semántica FIFO, ocupación explícita, overflow software y rechazo de
lectura corta.  
**Firmware:** reloj monotónico, timeline estimada continua, secuencia y
contadores de pérdidas separados.  
**Logger:** modos runtime `OFF/RAW/FULL`, sesiones, metadata, eventos,
referencias y estado.  
**Host:** capturador Python con log crudo, CSV y JSON.  
**Fuera de alcance preservado:** algoritmos biomédicos y funciones de producto.

## 2026-09-17 — Validación final host

**Pruebas:** 18/18 `OK`; incluye el parser real y escritura de artefactos.  
**Compilación:** `PASS`, ESP32 core 3.3.11, target `esp32:esp32:esp32`.  
**Uso:** flash 1.191.556 bytes (90 %); RAM global 60.848 bytes (18 %).  
**Tooling:** se corrigió `.arduino/arduino-cli.yaml` de la unidad inexistente
`G:` a la unidad actual `D:`.  
**Seguridad:** el `vitalwatch_config.h` privado usado para compilar fue retirado
de la carpeta entregable; queda solamente el ejemplo. Los binarios generados
con esa configuración también se excluyeron del paquete compartible.  
**Pendiente:** `pyserial`, carga física y captura con MAX30102 real.

## 2026-09-18 — Validación física y primera captura

**Equipo:** ESP32-D0WD-V3 rev. 3.1 en `COM3`, MAX30102 e IMU del prototipo.  
**Carga:** compilación final instalada tras entrar manualmente en bootloader
con IO0/BOOT; verificación de hash de flash correcta.  
**Entorno host:** entorno aislado `.tools/biomed-python` con `pyserial==3.5`.

Las capturas preflight reprodujeron una línea UART intercalada, muestras
fantasma por interpretación ambigua del FIFO y un `OVF_COUNTER` crudo anómalo.
Se corrigió la emisión atómica del logger, se tomó una fotografía conjunta de
los tres registros FIFO, se eliminó la inferencia de FIFO lleno con punteros
iguales y se alineó el FIFO una vez al iniciar el servicio.

La hoja de datos establece que OVF satura y se reinicia al extraer una muestra.
El módulo probado devolvió OVF=1 aun con backlog 1 y servicio normal; por ello
el valor crudo se conserva y una pérdida sólo se contabiliza si la respalda un
FIFO casi lleno o un gap capaz de llenarlo. La suite pasó a 22/22.

**Preflight final:** 200 muestras/8 s, 25 Hz, 0 corrupción, 0 huecos y 0
pérdidas corroboradas.  
**Captura real:** `RAW/20260918_143304_dedo_reposo_90s_anon`; 2250
muestras/89,96 s, 25 Hz, 0 huecos, 0 duplicados, 0 short read y 0 drops.  
**Resultado:** adquisición física `PASS`; exactitud biomédica `UNKNOWN` por
falta de referencia y calidad HR irregular.
