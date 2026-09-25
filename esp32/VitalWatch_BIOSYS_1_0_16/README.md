# VitalWatch BIOSYS 1.0.16 — PPG dual channel A

BIOSYS 1.0.16 integra SYS 0.9.9 y BIO 0.7.0 para el ESP32 clásico NodeMCU de
38 pines. Esta revisión sustituye la autoridad histórica de picos aislados por
un pipeline de frecuencia cardíaca que exige evidencia temporal coincidente en
los canales rojo e infrarrojo del MAX30102.

## Qué cambia

- filtrado FIR de memoria fija por canal;
- supresión de máximos secundarios compatible con 35–190 lpm;
- fusión obligatoria rojo/IR;
- FC robusta a partir de hasta ocho intervalos IBI;
- barreras de SNR, MAD, rango IBI, sincronización y tiempo limpio;
- cuarentena y recalibración ante movimiento, cambio óptico o tiempo inválido;
- resultado obsoleto eliminado inmediatamente al perder contacto o calidad;
- diagnóstico CSV ampliado y replay reproducible.

Los cambios no modifican `Sensor_Movimiento.*`, la detección de caídas, los
pines ni la línea temporal PPG heredada de 1.0.15.

## Compilar y probar

Desde `D:\vitalwatch-mobile`:

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

La evidencia reproducida está en
`RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md`. No se dispuso de oxímetro
comercial para comparación simultánea.

## Modos

- producto: interfaz, sensores y conectividad normales;
- investigación: transmite CSV ampliado para una captura controlada;
- replay: acepta filas históricas por Serial y ejecuta autotests; no es una
  imagen destinada al uso normal de la pulsera.

No incluir `vitalwatch_config.h` ni binarios compilados al compartir el código.
