# Cambios de BIOSYS 1.0.17

Fecha: 2026-09-25

Estado: **RESEARCH HYPOTHESIS ACCEPTED - REPLICATION PENDING**

## Hipótesis única

Las capturas físicas nuevas de BIOSYS 1.0.16 usaron LED fijo `0x35` y sólo
alcanzaron tramos `VALID` de 0 y 4,16 segundos. La captura histórica
`20260924-194014-dedo-quieto-timeline-a-toma-1.csv` usó LED `0x18`, mantuvo el
IR medio cerca de 79.000 y, al reproducirse con el pipeline 1.0.16, sostuvo
12,6 segundos de validez técnica.

BIOSYS 1.0.17 cambia únicamente la potencia óptica del modo de investigación:

- antes: rojo e IR fijos en `0x35`;
- candidato: rojo e IR fijos en `0x18`;
- modo normal: sin cambios;
- algoritmo HR: continúa en `0x0700`;
- detector, fusión, barreras, cuarentena y MPU: idénticos a 1.0.16.

## Puerta de aceptación física

Una captura nueva de 90 segundos debe cumplir simultáneamente:

- al menos 2.200 registros;
- cero filas descartadas;
- todos los deltas consecutivos a 40.000 us;
- cero pérdidas sospechadas y cero muestras faltantes;
- al menos 10.000 ms continuos con estado `VALID`;
- ningún `VALID` durante movimiento alto, transitorio óptico o tiempo inválido;
- evidencia rojo/IR suficiente en cada muestra `VALID`.

No se ajustará ningún umbral después de ver la captura. Si falla un criterio,
1.0.17 continuará como firmware de investigación y no se cargará la variante
normal.

## Compilación local

Los tres perfiles compilaron sin errores:

- producto: 1.183.772 bytes de programa y 56.560 bytes de RAM global;
- investigación: 1.186.452 bytes de programa y 60.880 bytes de RAM global;
- replay: 486.680 bytes de programa y 37.252 bytes de RAM global.

SHA-256 de la aplicación de investigación:
`7C0D4FB0F7FB5CBEED44C5FF6E4E356C3BFEF70FE4A24389AFF224BF144BC93D`.

La carga automática inicial por `COM3` no recibió datos serie. Esto no es una
falla de compilación; la placa requiere entrada manual al cargador ROM mediante
los botones `BOOT` y `EN` antes de repetir la escritura.

## Regresión física de replay

La imagen replay de 486.832 bytes se escribió en `0x10000` mediante el cargador
ROM a 57.600 baudios. La escritura finalizó al 100 % con
`Hash of data verified`.

- 23 de 23 autotests: PASS;
- 4 de 4 datasets inmutables: PASS;
- timeline estable: 12.600 ms continuos `VALID`, mediana 86 lpm;
- sin dedo y cambio de contacto: cero publicaciones `VALID`;
- ningún `unsafe_valid`, `single_channel_valid` ni
  `valid_during_quarantine`.

Esta regresión confirma que el pipeline de seguridad continúa igual a 1.0.16.

## Captura física LED 0x18

La imagen de investigación se escribió físicamente en el ESP32 al 100 % y
`esptool` confirmó `Hash of data verified`. El arranque leído desde `COM3`
identificó BIOSYS 1.0.17, SYS 0.9.9, BIO 0.7.1 y MAX30102 `PART_ID=0x15`.

La toma `20260925-121707-dedo-quieto-led-18-a-toma-1.csv` obtuvo:

- 2.250 registros y cero filas descartadas;
- 2.249 deltas consecutivos de 40.000 us, sin pérdidas ni muestras faltantes;
- 818 muestras `VALID` y un tramo continuo máximo de 32.720 ms;
- frecuencia técnicamente aceptada entre 69,77 y 78,95 lpm, mediana 75 lpm;
- cero `VALID` con movimiento alto, transitorio óptico o tiempo inválido;
- de 7 a 8 latidos rojo/IR sincronizados en cada muestra `VALID`.

La captura supera todos los criterios definidos antes de medir. La hipótesis
`PPG-LED-18-A` queda aceptada técnicamente. BIOSYS 1.0.17 permanece en modo de
investigación hasta repetir la toma y comprobar reproducibilidad antes de
trasladar la potencia óptica al perfil normal.

Evidencia estructurada:
`measurements/biosys-1.0.17/20260925-121707-dedo-quieto-led-18-a-toma-1-acceptance.json`.

`VALID` sólo expresa coherencia técnica interna. No constituye validación
clínica, diagnóstico médico ni comparación con un instrumento certificado.
