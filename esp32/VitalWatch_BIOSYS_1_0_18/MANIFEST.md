# Manifiesto técnico - BIOSYS 1.0.18 experimental

## Identidad

| Capa | Versión | Función |
|---|---:|---|
| Producto | BIOSYS 1.0.18 | firmware integrado de investigación |
| Sistema | SYS 0.9.9 | interfaz, conectividad, alertas y sincronización |
| Biomédica | BIO 0.7.2 | autoganancia PPG iniciada en LED 18 |
| App compatible | 1.0.12 | cliente móvil actual del repositorio |

Objetivo: ESP32 clásico NodeMCU de 38 pines, FQBN `esp32:esp32:esp32`.

## Cambio experimental

En `BIO_RESEARCH_MODE=1`, ambos LED comienzan en `0x18` y pueden subir hasta
`0x50` en pasos de `0x08` mientras se confirma y estabiliza el contacto. La
potencia queda fija al iniciar la medición.

El perfil normal conserva `0x50`, mínimo `0x35`, máximo `0xC0` y paso `0x10`.

## Integridad preservada

Estos archivos deben ser idénticos byte por byte a BIOSYS 1.0.17:

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
| Producto | 1.183.772 B | 56.560 B | 1.183.920 B | `3C839300A426B9A741BB6BF976DA346DC8B8D1968328DD275F5E0FC67B10CCB9` |
| Investigación | 1.186.452 B | 60.880 B | 1.186.608 B | `7E15173C832B9487A632E619A2CD35EA2B1689E9F515C49CB068E922480F15B5` |
| Replay | 486.680 B | 37.252 B | 486.832 B | `40E1AA816F01E9741F30CCD7814C86715C501C91ABD472C5054A131B20355169` |

Estos hashes prueban reproducibilidad local de compilación, no ejecución en la
placa.

## Evidencia requerida

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

La evidencia de 1.0.17 no se presenta como resultado físico de 1.0.18.
`VALID` es validez técnica interna y no constituye validación clínica.

## Exclusiones

No se distribuyen `vitalwatch_config.h`, credenciales, `build/`, `.bin`, `.elf`
ni `.map`. `vitalwatch_config.example.h` es una plantilla sin secretos.
