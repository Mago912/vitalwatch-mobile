# BIOSYS 1.0.20 - confirmación temporal para muñeca

Fecha: 2026-09-25

Estado: **CANDIDATO PENDIENTE DE VALIDACIÓN FÍSICA EN MUÑECA**

## Problema observado

BIOSYS 1.0.19 alcanzó cinco estados `VALIDA` consecutivos en una prueba con el
dedo. La salida del comando `P` imprimía el estado oficial junto al número de
MAXIM, por lo que parecía que la frecuencia válida saltaba de 78 a 214 lpm. El
número era experimental y no era el valor autorizado por `PpgValidityGate`.

Además, el proyecto final es una pulsera. La muñeca produce menos pulsación
óptica y más artefactos de movimiento que una yema, por lo que una aceptación
con el dedo no es suficiente.

## Cambios

- `hr=ESTADO(valor)` informa ahora la frecuencia oficial o `nan`;
- `maximHr=valor/válido` queda identificado como salida experimental;
- cinco candidatos coherentes deben caber en 12 lpm;
- la confirmación debe durar al menos 2,5 segundos;
- un salto mayor reinicia la confirmación;
- durante la confirmación se informa `INESTABLE`, pero no se publica un número;
- se agrega la razón `QR_BPM_UNCONFIRMED`;
- algoritmo HR `0x0701`, experimento `PPG-WRIST-STABILITY-20-A`.

No se reducen las barreras de SNR, coherencia IBI, doble canal, movimiento,
temporización o muestras perdidas.

## Verificación previa a la prueba de muñeca

- producto, investigación y replay compilaron correctamente;
- el replay se cargó y verificó físicamente en el ESP32 por `COM3`;
- 24/24 autotests y 4/4 datasets inmutables pasaron;
- el autotest de salto `80 -> 160` volvió a `INESTABLE` con `bpm=nan`;
- la referencia estable conservó 9.840 ms válidos y cero resultados inseguros.

Esto valida la lógica y no reemplaza la prueba física sobre la muñeca.

## Muñeca quieta, toma 1

El producto se instaló y confirmó MAX30102 `PART_ID=0x15`, el diagnóstico
separado y cero pérdidas. La primera captura de muñeca no fue aceptable como
prueba de reposo: hubo cinco inicios de contacto, oscilaciones ópticas desde
ausencia de contacto hasta casi saturación, 28 transitorios ópticos y 27
diagnósticos afectados por movimiento.

El filtro mostró cuatro veces un candidato oficial de 100 lpm como `INESTABLE`
por desacuerdo entre canales y no publicó ningún `VALIDA`. Resultado: **FAIL de
montaje, no de seguridad**. Se repite con el sensor sujeto y sin modificar
umbrales. Evidencia en `measurements/biosys-1.0.20/wrist-rest-take1*`.

## Antebrazo quieto, toma 2

Con el sensor apoyado en el antebrazo, el perfil normal mantuvo contacto durante
65 segundos sin pérdidas, pero la FC oficial no llegó a `VALIDA`. La razón
predominante fue `QR_CHANNEL_MISMATCH` (`0x0200`). La SpO2 que se mostró sigue
siendo experimental; no demuestra exactitud ni confirma la frecuencia cardíaca.

Se instaló temporalmente `BIO_RESEARCH_MODE=1` y se capturaron 120 segundos:
3.000 muestras completas a 25 Hz, cero pérdidas, cero marcas de movimiento o
transitorios ópticos y cero muestras de FC válida. Hubo 87 candidatos rojos,
61 infrarrojos y solo dos pares sincronizados; 2.868 muestras llevaron la razón
de desacuerdo entre canales. Una captura anterior de dedo con BIOSYS 1.0.18
tuvo 89/88 candidatos y 84 pares, como comparación orientativa entre montajes
y versiones, no como control de precisión.

Evidencia local: `measurements/biosys-1.0.20/20260926-125818-antebrazo-reposo-2.csv`.
La captura PPG está ignorada por Git. No se relajarán los filtros de seguridad
para publicar un número a partir de pulsos que no coinciden.

## Protocolo de muñeca

1. Mantener cinco segundos sin contacto como referencia.
2. Apoyar el sensor sobre la cara interna de la muñeca, con los LED contra la
   piel y sin entrada de luz por los laterales.
3. Sujetarlo de forma uniforme: firme para no deslizarse, pero sin presionar.
4. Mantener muñeca, cable y protoboard quietos durante 120 segundos.
5. Repetir en otra captura moviendo suavemente la muñeca durante 10 segundos.

La toma quieta debe lograr al menos 10 segundos continuos `VALIDA`, sin pérdidas.
La toma con movimiento no debe publicar una frecuencia válida durante el tramo
movido. Sin instrumento de referencia no se juzga exactitud y el resultado no
constituye validación clínica.
