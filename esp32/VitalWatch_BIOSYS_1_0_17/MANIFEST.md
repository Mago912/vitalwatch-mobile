# Manifiesto técnico — BIOSYS 1.0.17 experimental

## Identidad

| Capa | Versión | Función |
|---|---:|---|
| Producto | BIOSYS 1.0.17 | firmware integrado de investigación |
| Sistema | SYS 0.9.9 | interfaz, conectividad, alertas y sincronización |
| Biomédica | BIO 0.7.1 | ensayo óptico PPG LED 18 A |
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

Los módulos PPG heredados sin cambios desde 1.0.16 son:

- `PpgChannelDetector.cpp` y `PpgChannelDetector.h`;
- `PpgBeatFusion.cpp` y `PpgBeatFusion.h`;
- `PpgValidityGate.cpp` y `PpgValidityGate.h`.

## Perfiles reproducibles

| Perfil | Acción | Uso |
|---|---|---|
| Producto | `firmware:biosys:build` | funcionamiento normal conectado |
| Investigación | `firmware:biosys:research` | CSV físico ampliado |
| Replay | `firmware:biosys:replay` | replays inmutables y autotests |

Compilaciones de 1.0.17:

| Perfil | Flash | RAM global | Estado |
|---|---:|---:|---|
| Producto | 1.183.772 B | 56.560 B | PASS |
| Investigación | 1.186.452 B | 60.880 B | PASS |
| Replay | 486.680 B | 37.252 B | PASS |

Binarios de aplicación compilados localmente:

| Perfil | Tamaño `.bin` | SHA-256 |
|---|---:|---|
| Producto | 1.183.920 B | `5A250CF8D21AC9BA60C5FEC3D8C5A73671726EB0D2D6AE58B32860D324901A35` |
| Investigación | 1.186.608 B | `7C0D4FB0F7FB5CBEED44C5FF6E4E356C3BFEF70FE4A24389AFF224BF144BC93D` |
| Replay | 486.832 B | `BE375AA378738691E81A6A9FDA8078152B5B07B03A3A7238B6C69C071D8A9FB4` |

Estos hashes identifican las imágenes compiladas; todavía no prueban que hayan
sido escritas ni ejecutadas físicamente en la placa.

## Integridad preservada

`Sensor_Movimiento.cpp`, `Sensor_Movimiento.h`, `PpgSampleTimeline.h`,
`PpgChannelDetector.*`, `PpgBeatFusion.*` y `PpgValidityGate.*` deben ser
idénticos byte por byte a BIOSYS 1.0.16. Esta revisión no modifica caídas ni
criterios de validez.

## Evidencia

- `RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md` conserva la evidencia de 1.0.16.
- `CAMBIOS_1_0_17.md` define la hipótesis y la puerta de aceptación nuevas.
- `measurements/biosys-1.0.17/replay-results.json` registra la regresión física.
- Replay 1.0.17: **23/23 autotests y 4/4 datasets PASS**.
- Captura LED `0x18` toma 1: **PASS**, 2.250 registros, 0 descartados y
  32.720 ms continuos `VALID`.
- Captura LED `0x18` toma 2: **FAIL**, 2.250 registros, 0 descartados y sólo
  680 ms continuos `VALID` por inestabilidad óptica.
- Hipótesis `PPG-LED-18-A`: **resultado mixto; conservar en investigación**.
- `VALID` significa validez técnica interna; no es validación clínica.

## Exclusiones

No se distribuyen `vitalwatch_config.h`, credenciales, `build/`, `.bin`, `.elf`
ni `.map` dentro de un paquete fuente público. Se conserva
`vitalwatch_config.example.h` como plantilla sin secretos.
