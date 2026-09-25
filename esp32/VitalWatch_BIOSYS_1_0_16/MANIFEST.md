# Manifiesto técnico — BIOSYS 1.0.16 candidato

## Identidad

| Capa | Versión | Función |
|---|---:|---|
| Producto | BIOSYS 1.0.16 | firmware integrado de la pulsera |
| Sistema | SYS 0.9.9 | interfaz, conectividad, alertas y sincronización |
| Biomédica | BIO 0.7.0 | adquisición y validez técnica PPG dual channel A |
| App compatible | 1.0.12 | cliente móvil actual del repositorio |

Objetivo de hardware: ESP32 clásico NodeMCU de 38 pines, FQBN
`esp32:esp32:esp32`.

## Pipeline de frecuencia cardíaca

| Archivo | Responsabilidad |
|---|---|
| `PpgSampleTimeline.h` | secuencia y tiempo continuo de muestras |
| `PpgChannelDetector.h/.cpp` | FIR, calibración, candidatos y artefactos por canal |
| `PpgBeatFusion.h/.cpp` | coincidencia rojo/IR e historial robusto de IBI |
| `PpgValidityGate.h/.cpp` | contacto, movimiento, SNR, coherencia y cuarentena |
| `Sensor_Oxigeno.h/.cpp` | integración MAX30102 y resultado público |
| `BioResearch.h/.cpp` | CSV de investigación y diagnóstico ampliado |
| `BioReplay.h/.cpp` | protocolo de replay y autotests físicos |

Los archivos nuevos que deben formar parte de cualquier paquete 1.0.16 son:

- `PpgChannelDetector.cpp` y `PpgChannelDetector.h`;
- `PpgBeatFusion.cpp` y `PpgBeatFusion.h`;
- `PpgValidityGate.cpp` y `PpgValidityGate.h`.

## Perfiles reproducibles

| Perfil | Acción | Uso |
|---|---|---|
| Producto | `firmware:biosys:build` | funcionamiento normal conectado |
| Investigación | `firmware:biosys:research` | CSV físico ampliado |
| Replay | `firmware:biosys:replay` | replays inmutables y autotests |

Compilaciones finales verificadas:

| Perfil | Flash | RAM global | Estado |
|---|---:|---:|---|
| Producto | 1.183.772 B | 56.560 B | PASS |
| Investigación | 1.186.452 B | 60.880 B | PASS |
| Replay | 486.680 B | 37.252 B | PASS |

Los hashes SHA-256 completos de los binarios están en `CAMBIOS_1_0_16.md`.

## Integridad preservada

`Sensor_Movimiento.cpp`, `Sensor_Movimiento.h` y `PpgSampleTimeline.h` deben ser
idénticos byte por byte a BIOSYS 1.0.15. La revisión PPG no modifica el detector
de caídas ni sus umbrales.

## Evidencia

- `RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md` describe replays, hashes y
  limitaciones.
- `measurements/biosys-1.0.16/replay-results.json` contiene resultados
  estructurados de **CODEX REPRODUCTION TESTS**.
- Estado reproducido: **INDEPENDENTLY REPRODUCED**.
- `VALID` significa validez técnica interna; no es validación clínica.

## Exclusiones

No se distribuyen `vitalwatch_config.h`, credenciales, `build/`, `.bin`, `.elf`
ni `.map` dentro de un paquete fuente público. Se conserva
`vitalwatch_config.example.h` como plantilla sin secretos.
