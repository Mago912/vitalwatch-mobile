# Resumen final para el equipo

## Resultado

Se creó `Laboratorio_Pruebas_MAX30102_2026-09-17` como rama física separada del
baseline BIOSYS 1.0.8. El baseline extraído permanece sin editar.

Las seis irregularidades IRR-001…IRR-006 se reprodujeron independientemente
con pruebas nuevas de Codex. Resultado: **INDEPENDENTLY REPRODUCED**. No se
dispuso de `FINAL_BIOMED_CANDIDATE` y no se usaron ni atribuyeron tests de
Cowork.

## Entregables principales

- sketch experimental compilable;
- copia controlada del driver SparkFun corregida;
- logger `OFF/RAW/FULL` y protocolo `@VW_*`;
- capturador Python con salidas CSV/JSON y log crudo;
- 22 pruebas host aprobadas;
- informe reproducible de compilación (los binarios privados no se distribuyen);
- documentación de decisiones, cambios, validación, glosario y manifiesto.
- validación física en ESP32/MAX30102 y primera captura real de 90 segundos.

## Validación lograda

- SHA-256 del ZIP baseline verificado:
  `CEF0BE067CA84EE40EB9A0A3AA3457B9B62F73E07B266F283E6675FCBDBE3186`.
- CODEX REPRODUCTION TESTS: 22 ejecutados, 22 `OK`.
- Compilación `esp32:esp32:esp32`, core 3.3.11: `PASS`.
- Flash: 1.191.864 / 1.310.720 bytes (90 %).
- RAM global: 60.856 / 327.680 bytes (18 %).
- Carga física en COM3 y verificación de flash: `PASS`.
- Captura `dedo_reposo_90s`: 2250 muestras a 25 Hz, 0 huecos, 0 duplicados,
  0 lecturas cortas, 0 drops y timing válido 2250/2250.

## Pendiente honesto

- repetir con referencia externa simultánea y protocolo controlado;
- investigar la calidad HR irregular, especialmente el tramo sin BPM entre
  40–50 s y el salto transitorio observado entre 50–60 s;
- comparar el `OVF_COUNTER` crudo anómalo con otro módulo MAX30102;
- revisar el retorno de `TIMEOUT` a `RESULT_READY` en la máquina de sesión;
- analizar exactitud biomédica. Sigue siendo `UNKNOWN` sin referencia.

La adquisición física aprobó, pero no debe promoverse este laboratorio a
firmware estable ni interpretarse como validación médica hasta resolver los
pendientes algorítmicos y comparar contra instrumentos de referencia.
