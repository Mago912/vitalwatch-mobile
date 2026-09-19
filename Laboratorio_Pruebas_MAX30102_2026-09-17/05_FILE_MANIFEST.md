# 05 — Manifiesto de archivos

## BASELINE UNCHANGED

- `baseline_extracted/`: copia mecánica del ZIP verificado; no editar.
- ZIP de origen externo a esta carpeta; SHA-256 documentado en
  `00_ANALISIS_PREVIO.md`.

## EXPERIMENTAL MODIFIED

- `firmware/Laboratorio_Pruebas_MAX30102_2026_09_17/Configuracion.h`
- `firmware/Laboratorio_Pruebas_MAX30102_2026_09_17/Sensor_Oxigeno.h`
- `firmware/Laboratorio_Pruebas_MAX30102_2026_09_17/Sensor_Oxigeno.cpp`
- `firmware/Laboratorio_Pruebas_MAX30102_2026_09_17/BioResearch.h`
- `firmware/Laboratorio_Pruebas_MAX30102_2026_09_17/BioResearch.cpp`
- `firmware/Laboratorio_Pruebas_MAX30102_2026_09_17/Laboratorio_Pruebas_MAX30102_2026_09_17.ino`
- `libraries/SparkFun_MAX3010x_Lab/src/MAX30105.h`
- `libraries/SparkFun_MAX3010x_Lab/src/MAX30105.cpp`

## EXPERIMENTAL NEW

- `firmware/Laboratorio_Pruebas_MAX30102_2026_09_17/MonotonicMicros.h`
- `firmware/Laboratorio_Pruebas_MAX30102_2026_09_17/MonotonicMicros.cpp`
- `RAW/20260918_140400_preflight_sin_dedo_anon/`: primer preflight; evidencia
  de intercalado UART y de la interpretación OVF descartada.
- `RAW/20260918_143152_preflight_safeguard_anon/`: preflight final limpio.
- `RAW/20260918_143304_dedo_reposo_90s_anon/`: primera captura real de 90 s;
  incluye resumen local de análisis.

## TOOLS

- `tools/capture_biomed.py`: parser y capturador serie.
- `tools/requirements.txt`: dependencia fijada `pyserial==3.5`.

## TESTS

- `tests/test_acquisition_contract.py`
- `tests/test_capture_biomed.py`
- `tests/README.md`

Todas son **CODEX REPRODUCTION TESTS**, no pruebas originales de Cowork.

## DOCUMENTATION

- `00_ANALISIS_PREVIO.md`
- `01_DECISION_LOG.md`
- `02_CAMBIOS_EXPLICADOS.md`
- `03_VALIDATION_STATUS.md`
- `04_WORK_LOG.md`
- `05_FILE_MANIFEST.md`
- `06_VALIDACION_FISICA_2026-09-18.md`
- `BIO_CAPTURE_README.md`
- `BIO_GLOSSARY.md`
- `RESUMEN_FINAL_PARA_EQUIPO.md`
- `COMPILACION.txt`
- `TEST_RESULTS.txt`
- `CAMBIOS_DESDE_BASELINE.diff`

## EXCLUIDO INTENCIONALMENTE

- `vitalwatch_config.h`: contiene configuración privada y no se distribuye.
- binarios compilados con la configuración privada: la compilación se verificó
  y documentó, pero esos artefactos pueden contener valores embebidos.
- `FINAL_BIOMED_CANDIDATE`: `NOT_AVAILABLE`.
- artefactos o tests originales de Cowork: no entregados a esta tarea.
- `RAW/` en el ZIP compartible: las capturas permanecen locales por contener
  datos biométricos, aunque el sujeto figure como `anon`.
