# VitalWatch BIOSYS 1.0.21 - integridad del FIFO PPG

BIOSYS 1.0.21 integra SYS 0.9.9 y BIO 0.7.4 para el ESP32 clásico NodeMCU de
38 pines. Conserva los filtros biomédicos de 1.0.20 y rechaza conteos FIFO que
el MAX30102 no puede producir físicamente.

## Qué cambia frente a 1.0.20

- acepta solamente conteos `sensor.check()` entre 0 y 31;
- rechaza valores corruptos como 125, 65440 y 65535;
- no convierte esas lecturas en pérdidas ni adelanta el reloj fisiológico;
- limpia el FIFO y mantiene la salida inválida durante la recuperación;
- identifica el experimento como `PPG-FIFO-INTEGRITY-21-A`.

No cambian el detector de picos, la fusión rojo/IR, los límites IBI, la
autoganancia, `Sensor_Movimiento.*`, los pines ni los umbrales médicos.

## Comandos

Desde la raíz real del proyecto, en esta sesión `D:\vitalwatch-mobile`:

```powershell
npm run test:biosys:replay
npm run firmware:biosys:build
npm run firmware:biosys:research
npm run firmware:biosys:replay
```

## Resultado físico actual

El perfil Research fue probado con el MAX30102 aislado. La captura de
antebrazo eliminó los saltos FIFO imposibles, pero no logró FC válida. Una
captura separada de 60 s en el dedo conservó 25 Hz sin pérdidas y obtuvo 301
muestras técnicamente válidas, con mediana de 78,95 lpm y un tramo continuo de
7,6 s. Esto demuestra funcionamiento técnico bajo buena señal, no precisión.

## Validación de muñeca pendiente

La prueba final debe hacerse con el MAX30102 contra la muñeca, sin luz lateral,
con contacto uniforme y sin presionar hasta cortar el flujo sanguíneo. Se debe
probar por separado una muñeca quieta y movimiento deliberado.

`VALIDA` significa validez técnica interna. No constituye validación clínica,
diagnóstico ni garantía de exactitud médica.

No incluir `vitalwatch_config.h` ni binarios compilados al compartir el código.

## Diagnóstico simultáneo de FC interna y publicada

El perfil opcional [HRPAIR-1](DIAGNOSTICO_HRPAIR_1.md) compara ambos resultados
en funcionamiento normal, sin modificar los filtros biomédicos. Se cargó y
verificó por serie el 2026-09-28. La [primera toma controlada de 120 s](RESULTADOS_HRPAIR_DEDO_2026-09-28.md)
registró 18/119 consultas con FC interna válida y 9/119 con resultado publicado
válido; persisten tanto inestabilidad interna como retrasos de publicación.
Las pruebas del analizador y de comunicación no son una validación clínica
ni una demostración de mejora de la señal.

La [reproducción nativa de publicación y fusión](REPRODUCCION_PUBLICACION_Y_FUSION_2026-09-28.md)
confirmó tres comportamientos de publicación a corregir y la ruta de vaciado
por IBI largo. Aún no se aplicó una corrección al firmware.
