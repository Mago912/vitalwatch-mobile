# Manifiesto técnico - BIOSYS 1.0.20 candidato para muñeca

## Identidad

| Capa | Versión | Función |
|---|---:|---|
| Producto | BIOSYS 1.0.20 | candidato integrado |
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

## Compilación reproducible

| Perfil | Programa | RAM global | `.bin` | SHA-256 |
|---|---:|---:|---:|---|
| Producto | 1.184.516 B | 56.600 B | 1.184.672 B | `38730FB190433EA8F0F08C9F1EF56A57920BA374214E8EAAFD7EC246092CBD86` |
| Investigación | 1.187.212 B | 60.920 B | 1.187.360 B | `2EFB10F342C1913BEF428C01865377AC5B4017710179C26AAA3782F72F8018E4` |
| Replay | 488.104 B | 37.292 B | 488.256 B | `6AB1CB5E9ACBA50C94B307EB41525B1AEF1BF691F62D4BFD850D3AEC12F4F55C` |

Estos datos prueban compilación local, no funcionamiento físico.

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

## Validación física obligatoria

Estado actual: **REPLAY Y PRODUCTO INSTALADO; MUÑECA PENDIENTE**.

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

1. Repetir al menos 120 segundos con el sensor sujeto a la muñeca quieta.
2. Registrar una prueba separada con movimiento deliberado.
3. Confirmar cero pérdidas y ausencia de resultados válidos durante movimiento.
4. Exigir un tramo `VALIDA` continuo de al menos 10 segundos en reposo.

Sin un pulsómetro u oxímetro de referencia no se evaluará exactitud. Ningún
resultado constituye validación clínica, diagnóstico ni garantía médica.

## Exclusiones

No se distribuyen `vitalwatch_config.h`, credenciales, `build/`, `.bin`, `.elf`
ni `.map`. `vitalwatch_config.example.h` es una plantilla sin secretos.
