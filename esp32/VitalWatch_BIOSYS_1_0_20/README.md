# VitalWatch BIOSYS 1.0.20 - estabilidad PPG para muñeca

BIOSYS 1.0.20 integra SYS 0.9.9 y BIO 0.7.4 para el ESP32 clásico NodeMCU de
38 pines. Parte de la autoganancia de 1.0.19 y agrega una confirmación temporal
antes de publicar la frecuencia cardíaca como técnicamente válida.

## Qué cambia frente a 1.0.19

- conserva los LED entre `0x18` y `0x50` durante la estabilización;
- exige cinco estimaciones robustas dentro de un rango de 12 lpm;
- exige al menos 2,5 segundos entre la primera y la última confirmación;
- reinicia la confirmación ante un salto grande de frecuencia;
- no muestra ni transmite un número mientras permanece sin confirmar;
- separa `hr`, resultado oficial, de `maximHr`, dato experimental;
- identifica el algoritmo como `PPG-WRIST-STABILITY-20-A`.

No cambian el detector de picos, la fusión rojo/IR, los límites IBI, la
autoganancia, `Sensor_Movimiento.*`, los pines ni la línea temporal PPG.

## Comandos

Desde `F:\vitalwatch-mobile`:

```powershell
python -m unittest esp32.tests.test_biosys_1_0_20_ppg
npm run firmware:biosys:build
npm run firmware:biosys:research
npm run firmware:biosys:replay
npm run test:biosys:replay
```

## Validación pendiente

La prueba final debe hacerse con el MAX30102 contra la muñeca, sin luz lateral,
con contacto uniforme y sin presionar hasta cortar el flujo sanguíneo. Se debe
probar por separado una muñeca quieta y movimiento deliberado.

`VALIDA` significa validez técnica interna. No constituye validación clínica,
diagnóstico ni garantía de exactitud médica.

No incluir `vitalwatch_config.h` ni binarios compilados al compartir el código.
