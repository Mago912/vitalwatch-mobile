# Laboratorio de pruebas MAX30102 — 2026-09-17

Laboratorio experimental derivado de VitalWatch BIOSYS 1.0.8. Está orientado
a medir integridad de adquisición y generar datasets reproducibles. No es una
versión estable ni un dispositivo médico.

## Orden de lectura

1. `00_ANALISIS_PREVIO.md`
2. `01_DECISION_LOG.md`
3. `02_CAMBIOS_EXPLICADOS.md`
4. `03_VALIDATION_STATUS.md`
5. `BIO_CAPTURE_README.md`
6. `06_VALIDACION_FISICA_2026-09-18.md`
7. `RESUMEN_FINAL_PARA_EQUIPO.md`

El glosario está en `BIO_GLOSSARY.md`; el historial y el inventario están en
`04_WORK_LOG.md` y `05_FILE_MANIFEST.md`.

## Carpetas

- `baseline_extracted/`: baseline de referencia sin editar.
- `firmware/`: sketch experimental; no contiene credenciales.
- `libraries/`: copia privada corregida de SparkFun MAX3010x.
- `tests/`: **CODEX REPRODUCTION TESTS**.
- `tools/`: capturador Python.
- `RAW/`: sesiones físicas locales; contienen datos biométricos sensibles.

Antes de compilar, copie `vitalwatch_config.example.h` como
`vitalwatch_config.h` dentro del sketch y complete localmente sus valores. No
comparta ese archivo. Compile usando `libraries/` como directorio adicional de
bibliotecas para garantizar que se usa el driver del laboratorio.

`FINAL_BIOMED_CANDIDATE` es `NOT_AVAILABLE`; no forma parte de esta entrega.
