# Manifiesto técnico - BIOSYS 1.0.21 integridad FIFO PPG

## Identidad

| Capa | Versión | Función |
|---|---:|---|
| Producto | BIOSYS 1.0.21 | candidato integrado |
| Sistema | SYS 0.9.9 | interfaz, conectividad y alertas |
| Biomédica | BIO 0.7.4 | estabilidad temporal PPG |
| App compatible | 1.0.12 | cliente móvil actual |

Objetivo: ESP32 clásico NodeMCU de 38 pines, FQBN `esp32:esp32:esp32`, MAX30102
`PART_ID=0x15` y pantalla ST7735 1,44 pulgadas.

## Fundamento

BIOSYS 1.0.19 confirmó físicamente que el perfil normal reconoce contacto,
procesa ambos canales y puede alcanzar `VALIDA` sin pérdidas. Aquella consulta
serial mostraba dentro de los paréntesis el resultado experimental MAXIM, no la
frecuencia autorizada por el filtro principal. Esa ambigüedad se corrige aquí.

La prueba anterior se hizo con un dedo. Sirve como prueba del recorrido técnico,
pero no valida el uso final en una pulsera.

## Cambio biomédico

El filtro existente sigue exigiendo contacto, ausencia de movimiento, doble
canal, SNR suficiente, seis IBI, coherencia y cinco segundos limpios. Después de
esas barreras, 1.0.20 exige además:

- cinco estimaciones robustas distintas;
- rango máximo de 12 lpm entre ellas;
- al menos 2,5 segundos de confirmación;
- reinicio de la confirmación ante un salto mayor;
- ningún número visible o remoto mientras la nueva frecuencia no se confirme.

La línea de diagnóstico usa `hr=ESTADO(valor)` para el resultado autorizado y
`maximHr=valor/válido` para el cálculo experimental.

## Integridad preservada

Estos módulos deben permanecer idénticos a BIOSYS 1.0.19:

- `PpgSampleTimeline.h`;
- `PpgChannelDetector.cpp` y `.h`;
- `PpgBeatFusion.cpp` y `.h`;
- `Sensor_Movimiento.cpp` y `.h`;
- control remoto, medicación y telemetría.

## Compilación reproducible de 1.0.20 (baseline)

| Perfil | Programa | RAM global | `.bin` | SHA-256 |
|---|---:|---:|---:|---|
| Producto | 1.184.516 B | 56.600 B | 1.184.672 B | `38730FB190433EA8F0F08C9F1EF56A57920BA374214E8EAAFD7EC246092CBD86` |
| Investigación | 1.187.212 B | 60.920 B | 1.187.360 B | `2EFB10F342C1913BEF428C01865377AC5B4017710179C26AAA3782F72F8018E4` |
| Replay | 488.104 B | 37.292 B | 488.256 B | `6AB1CB5E9ACBA50C94B307EB41525B1AEF1BF691F62D4BFD850D3AEC12F4F55C` |

## Compilación de 1.0.21

| Perfil | Programa | RAM global | `.bin` | SHA-256 |
|---|---:|---:|---:|---|
| Producto | 1.184.560 B | 56.600 B | 1.184.704 B | `219B3372A78A15D2C040A4BC8352D6962C99AB89CDED68CE725D0B3B117E343E` |
| Investigación | 1.187.260 B | 60.920 B | 1.187.408 B | `AB4F6808648D819D15CBAA2D2C3837FB0C3BADA1CA6A269C2CB9A0880F7D1E76` |
| Replay | 488.104 B | 37.292 B | 488.256 B | `22E14AD1CE6750F2E61F6ADCD4C0BE0B1F78C8905D41B7B2FD29B56DE406FAAA` |

La prueba específica `ppg_fifo_guard_test` compila y rechaza los conteos
imposibles observados físicamente. Las seis pruebas de Replay y las ocho
pruebas de interpretación de telemetría también pasan.

La validación física de 1.0.21 Research confirmó la adquisición continua y la
recuperación segura. Los tamaños y hashes de esta tabla prueban compilación
local; la evidencia física separada se describe más abajo.

## Replay físico

El replay se escribió físicamente por `COM3` y `esptool` verificó el hash de
cada bloque. Resultado:

- 24/24 autotests PASS;
- 4/4 datasets inmutables PASS;
- el salto sintético `80 -> 160` quedó `INESTABLE`, sin BPM publicado;
- cero resultados inseguros, de canal único o durante cuarentena;
- la referencia estable conservó 9.840 ms continuos `VALID` después de agregar
  la confirmación temporal.

La evidencia está en `measurements/biosys-1.0.20/replay-results.json`.

## Validación física

Estado actual: **BIOSYS 1.0.21 NORMAL RESTAURADO DESPUÉS DE DOS CAPTURAS EN
DEDO CON RESEARCH; VALIDACIÓN DE MUÑECA PENDIENTE**.

Restauración final del 2026-09-28: el nuevo binario normal tiene 1.184.704 B
y SHA-256 `AB2A2035E3990FB473FA72D79641D6925172805CFD290F14DDBE46806850944D`.
Este hash identifica la recompilación instalada al cerrar las capturas; los
hashes de la tabla anterior corresponden a las compilaciones anteriores.
La actualización rápida no superó su verificación inicial; esptool escribió
entonces la imagen completa, verificó el hash y terminó con código 0.
Los comandos P e I respondieron a 115200 baudios después del reinicio:
MAX30102 listo, PART_ID=0x15, contacto=0, ovf=0 y ppgDrops=0.

Las dos tomas Research de dedo con luz habitual alcanzaron respectivamente
107,64 y 55,00 s continuos de FC internamente válida. La segunda se hizo
después de recolocar el dedo. Ver RESULTADOS_DEDO_LUZ_HABITUAL_2026-09-28.md
y RESULTADOS_REPOSICION_DEDO_2026-09-28.md. La consulta sin dedo después de
restaurar no sustituye una prueba de estabilidad de FC en el perfil normal.

Comprobación posterior en normal: 120 consultas P en 120 s, con 25 VALIDA,
mediana 75 lpm y contacto presente en todas las consultas. La estabilidad sigue
pendiente. P consulta hrDisplay, publicado ordinariamente cada 5 s, mientras
que Research registra hr por muestra; no son métricas directamente comparables.
Ver RESULTADOS_NORMAL_DEDO_2026-09-28.md para resultados y limitaciones.

El perfil normal fue escrito por `COM3` al 100 %, con hash verificado por
`esptool`. Después del reinicio, el comando `P` confirmó MAX30102 listo,
`PART_ID=0x15` y cero pérdidas. El MPU permaneció desconectado de forma
intencional durante esta etapa.

El perfil normal se escribió al 100 % por `COM3` y `esptool` verificó el hash.
El diagnóstico nuevo confirmó MAX30102 `PART_ID=0x15`, salida oficial separada
de MAXIM y cero pérdidas.

Muñeca quieta, toma 1: **FAIL de montaje**. Solo 72 de 139 diagnósticos limpios
mantuvieron contacto y hubo cinco inicios de contacto independientes, 28
transitorios ópticos y 27 diagnósticos con movimiento. Los niveles oscilaron
entre ausencia de contacto y casi saturación. El firmware no publicó `VALIDA`.
Se repetirá con el sensor sujeto antes de iniciar la captura, sin cambiar
umbrales.

Antebrazo quieto, toma 2: **contacto estable, pero FC no validada**. El perfil
de investigación registró 3.000 muestras a 25 Hz sin pérdidas ni movimiento
detectado: 87 candidatos rojos, 61 infrarrojos y solo dos pares sincronizados.
La causa principal fue `QR_CHANNEL_MISMATCH`. La SpO2 experimental visible no
constituye validación de exactitud. Datos en
`measurements/biosys-1.0.20/20260926-125818-antebrazo-reposo-2.csv`.

MAX30102 aislado, BIOSYS 1.0.21, antebrazo: **integridad FIFO corregida, FC no
validada**. Se obtuvieron 3.284 muestras; no hubo pérdidas sospechadas ni
saltos de secuencia de 65 mil muestras. El mayor intervalo fue 1,12 s y el
firmware mantuvo la salida inválida durante las recuperaciones. Evidencia:
`measurements/biosys-1.0.21/20260928-195729-antebrazo-max30102-aislado-biosys-1-0-21-toma-1.csv`.

MAX30102 aislado, BIOSYS 1.0.21, dedo de referencia: **FC técnicamente válida,
sin referencia clínica**. Las 1.499 muestras conservaron 25 Hz exactos, sin
pérdidas, transitorios ni movimiento. Hubo 301 muestras válidas; el tramo más
largo duró 7,6 s y la mediana fue 78,95 lpm. Ninguna muestra válida vulneró
las barreras de seguridad. Evidencia:
`measurements/biosys-1.0.21/20260928-200329-dedo-referencia-biosys-1-0-21-toma-1.csv`.

Esto confirma que el sensor, el bus y el algoritmo pueden producir FC válida
con buen acoplamiento óptico. No demuestra precisión y no resuelve todavía el
montaje final de muñeca.

1. Crear un soporte opaco con presión uniforme para el sensor en la muñeca.
2. Repetir al menos 120 segundos con la muñeca quieta.
3. Registrar una prueba separada con movimiento deliberado.
4. Confirmar cero pérdidas y ausencia de resultados válidos durante movimiento.
5. Exigir un tramo `VALIDA` continuo de al menos 10 segundos en reposo.

Incidencia separada: sin dedo y con el MPU desconectado, la telemetría contiene
solo valores biomédicos `null`; la función remota actual la rechaza con HTTP
400 porque exige al menos un número o evento. Esto no es un error PPG. Debe
decidirse por separado si Supabase aceptará un paquete explícito de presencia.

Sin un pulsómetro u oxímetro de referencia no se evaluará exactitud. Ningún
resultado constituye validación clínica, diagnóstico ni garantía médica.

## Exclusiones

No se distribuyen `vitalwatch_config.h`, credenciales, `build/`, `.bin`, `.elf`
ni `.map`. `vitalwatch_config.example.h` es una plantilla sin secretos.
