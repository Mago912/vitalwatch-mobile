# VitalWatch BIOSYS 1.0.17 — ensayo óptico LED 18 A

BIOSYS 1.0.17 integra SYS 0.9.9 y BIO 0.7.1 para el ESP32 clásico NodeMCU de
38 pines. Conserva el pipeline PPG dual de 1.0.16 y prueba una sola hipótesis:
en modo de investigación fija ambos LED del MAX30102 en `0x18`, potencia usada
por la captura histórica que sostuvo 12,6 segundos de validez técnica.

## Qué cambia frente a 1.0.16

- `BIO_RESEARCH_MODE=1`: LED rojo e IR fijos en `0x18`;
- identificador experimental `PPG-LED-18-A`;
- nueva identidad BIOSYS 1.0.17 / BIO 0.7.1;
- capturas guardadas separadamente en `measurements/biosys-1.0.17`.

No cambian el detector de picos, la fusión rojo/IR, los límites IBI, las
barreras de validez, el modo normal, `Sensor_Movimiento.*`, los pines ni la
línea temporal PPG.

## Compilar y probar

Desde `F:\vitalwatch-mobile`:

```powershell
npm run firmware:biosys:build
npm run firmware:biosys:research
npm run firmware:biosys:replay
npm run test:biosys:replay
```

Para cargar una variante se usa el puerto detectado, por ejemplo:

```powershell
npm run firmware:ports
npm run firmware:biosys:replay:upload -- -Port COM3
```

## Interpretación segura

El estado `VALID` significa **validez técnica** dentro del algoritmo: contacto,
temporización, señal dual, coherencia y ausencia de artefactos detectados. No
constituye validación clínica, diagnóstico ni garantía de exactitud médica.

La evidencia de 1.0.16 está en `RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md`.
La evaluación física de 1.0.17 debe generarse nuevamente; no se dispone de
oxímetro comercial para comparación simultánea.

## Modos

- producto: interfaz, sensores y conectividad normales;
- investigación: transmite CSV ampliado para una captura controlada;
- replay: acepta filas históricas por Serial y ejecuta autotests; no es una
  imagen destinada al uso normal de la pulsera.

No incluir `vitalwatch_config.h` ni binarios compilados al compartir el código.
