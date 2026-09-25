# VitalWatch BIOSYS 1.0.19 - autoganancia del producto

BIOSYS 1.0.19 integra SYS 0.9.9 y BIO 0.7.3 para el ESP32 clásico NodeMCU de
38 pines. Promueve al perfil normal la autoganancia físicamente validada en
BIOSYS 1.0.18, sin relajar las barreras de validez.

## Qué cambia frente a 1.0.18

- producto e investigación comienzan ambos LED en `0x18`;
- la autoganancia puede subir hasta `0x50` en pasos de `0x08`;
- el ajuste termina antes de procesar los latidos de la medición;
- identificador `PPG-AUTOGAIN-PRODUCT-19-A`;
- identidad BIOSYS 1.0.19 / BIO 0.7.3;
- futuras capturas separadas en `measurements/biosys-1.0.19`.

No cambian el detector de picos, la fusión rojo/IR, los límites IBI, las
barreras de validez, `Sensor_Movimiento.*`, los pines ni la línea temporal PPG.

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

La evidencia física que permite esta promoción está en
`measurements/biosys-1.0.18`. BIOSYS 1.0.19 necesita compilación, replay y una
captura física propia antes de considerarse versión instalada y validada.

No incluir `vitalwatch_config.h` ni binarios compilados al compartir el código.
