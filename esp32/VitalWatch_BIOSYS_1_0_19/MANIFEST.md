# Manifiesto técnico - BIOSYS 1.0.19 candidato de producto

## Identidad

| Capa | Versión | Función |
|---|---:|---|
| Producto | BIOSYS 1.0.19 | candidato integrado de producto |
| Sistema | SYS 0.9.9 | interfaz, conectividad, alertas y sincronización |
| Biomédica | BIO 0.7.3 | autoganancia PPG promovida al producto |
| App compatible | 1.0.12 | cliente móvil actual del repositorio |

Objetivo: ESP32 clásico NodeMCU de 38 pines, FQBN `esp32:esp32:esp32`.

## Cambio promovido

En producto e investigación, ambos LED comienzan en `0x18` y pueden subir hasta
`0x50` en pasos de `0x08` mientras se confirma y estabiliza el contacto. La
potencia queda fija al iniciar la medición.

## Integridad preservada

Estos archivos deben ser idénticos byte por byte a BIOSYS 1.0.18:

- `PpgSampleTimeline.h`;
- `PpgChannelDetector.cpp` y `.h`;
- `PpgBeatFusion.cpp` y `.h`;
- `PpgValidityGate.cpp` y `.h`;
- `Sensor_Movimiento.cpp` y `.h`.

No se modifican caídas, SOS, medicamentos, telemetría ni criterios de validez.

## Perfiles reproducibles

| Perfil | Acción | Estado |
|---|---|---|
| Producto | `firmware:biosys:build` | compilación PASS |
| Investigación | `firmware:biosys:research` | compilación PASS |
| Replay | `firmware:biosys:replay` | compilación y ejecución física PASS |

| Perfil | Programa | RAM global | `.bin` | SHA-256 |
|---|---:|---:|---:|---|
| Producto | 1.183.772 B | 56.560 B | 1.183.920 B | `28C3DAD38EE36DEEE3102105344F9E5D8135A20AB050300291074B01D1A3E04C` |
| Investigación | 1.186.452 B | 60.880 B | 1.186.608 B | `28CF51F7315C456F9854119F09D7860C67272079DA5879D91D52EC63DCCE2FCB` |
| Replay | 486.680 B | 37.252 B | 486.832 B | `AA7582A7BB4FE553252BA9E970617D6F1DD8838CE55860D4BC658F85D9E45A43` |

Estos hashes prueban reproducibilidad local de compilación, no ejecución en la
placa.

## Evidencia heredada como fundamento, no como ejecución 1.0.19

- regresión física de los 23 autotests: **23/23 PASS**;
- replay físico de los cuatro datasets inmutables: **4/4 PASS**;
- toma estable de 90 segundos;
- prueba separada de señal débil y aumento de potencia;
- cero publicaciones `VALID` durante ajuste, cuarentena o artefactos.

Captura estable toma 1: 2.250 registros, 0 descartados, LED fijo en `0x18`,
pero sólo 1.880 ms continuos `VALID`. Resultado: **FAIL, repetir contacto**.

Intento 2: 2.250 registros, 0 descartados y 2.250 muestras `SIN DEDO` con los
canales cerca de 500. Resultado: **configuración de contacto inválida**; el
firmware no fabricó una frecuencia y la prueba estable debe repetirse.

Captura estable toma 3: 2.250 registros, 0 descartados, 27.240 ms continuos
`VALID`, sincronización mínima de 7 y LED fijo en `0x18`. Resultado: **PASS
para contacto estable y ganancia fija**. Pendiente: aumento con señal débil.

Señal débil toma 1: 2.251 registros, 0 descartados, subida `0x18 -> 0x20 ->
0x28`, congelamiento al terminar la estabilización y cero publicaciones
`VALID` durante ajuste o transitorios. Resultado: **PASS de autoganancia**.

El replay se escribió en `0x10000` al 100 % y `esptool` verificó su hash.
`measurements/biosys-1.0.18/replay-results.json` conserva los resultados.

La evidencia de 1.0.18 no se presenta como resultado físico de 1.0.19.
`VALID` es validez técnica interna y no constituye validación clínica.

## Replay físico propio de 1.0.19

El binario replay de 486.832 bytes con SHA-256
`AA7582A7BB4FE553252BA9E970617D6F1DD8838CE55860D4BC658F85D9E45A43`
se escribió al 100 % y verificó su hash en el ESP32 conectado por `COM3`.

Resultado: **23/23 autotests y 4/4 datasets PASS**, con cero resultados
inseguros, cero validaciones de canal único y cero valores válidos durante
cuarentena. La evidencia está en `measurements/biosys-1.0.19`.

## Exclusiones

No se distribuyen `vitalwatch_config.h`, credenciales, `build/`, `.bin`, `.elf`
ni `.map`. `vitalwatch_config.example.h` es una plantilla sin secretos.
