# VitalWatch BIOSYS 1.0.18 - autoganancia desde LED 18

BIOSYS 1.0.18 integra SYS 0.9.9 y BIO 0.7.2 para el ESP32 clásico NodeMCU de
38 pines. Parte de la evidencia física de 1.0.17 y prueba una sola hipótesis:
adaptar la potencia óptica durante la estabilización sin relajar la validez.

## Qué cambia frente a 1.0.17

- `BIO_RESEARCH_MODE=1` comienza ambos LED en `0x18`;
- la autoganancia puede subir hasta `0x50` en pasos de `0x08`;
- el ajuste termina antes de procesar los latidos de la medición;
- identificador experimental `PPG-AUTOGAIN-18-A`;
- identidad BIOSYS 1.0.18 / BIO 0.7.2;
- capturas separadas en `measurements/biosys-1.0.18`.

No cambian el detector de picos, la fusión rojo/IR, los límites IBI, las
barreras de validez, el perfil normal, `Sensor_Movimiento.*`, los pines ni la
línea temporal PPG.

## Comandos

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
npm run firmware:biosys:research:upload -- -Port COM3
```

## Interpretación segura

El estado `VALID` significa validez técnica interna: contacto, temporización,
señal dual, coherencia y ausencia de artefactos detectados. No constituye
validación clínica, diagnóstico ni garantía de exactitud médica.

La evidencia física que originó este experimento está en
`measurements/biosys-1.0.17`. BIOSYS 1.0.18 necesita compilación, replay y
capturas físicas propias antes de considerar cualquier cambio del producto.

No incluir `vitalwatch_config.h` ni binarios compilados al compartir el código.
