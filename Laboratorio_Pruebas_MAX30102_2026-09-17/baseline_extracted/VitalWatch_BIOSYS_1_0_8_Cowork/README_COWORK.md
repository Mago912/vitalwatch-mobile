# VitalWatch BIOSYS 1.0.8 — paquete para Cowork

Este paquete reúne el baseline de firmware `VW-BIOSYS 1.0.8`, sus bibliotecas
Arduino instaladas y la documentación disponible sobre versión, cambios,
arquitectura y validación.

## Identidad verificada

- Producto: `VW-BIOSYS 1.0.8`.
- Sistema: `VW-SYS 0.9.8`.
- Biomédica: `VW-BIO 0.6.3`.
- App declarada compatible por el firmware: VitalWatch `1.0.9`.
- Placa/FQBN: ESP32 clásico, `esp32:esp32:esp32`.
- Core: ESP32 Arduino `3.3.11`.

## Contenido

- `firmware/VitalWatch_BIOSYS_1_0_8/`: fuente y documentación propia de la
  versión. Se excluyeron la configuración privada y los artefactos de build.
- `libraries/`: copia de las bibliotecas Arduino directas y transitivas que
  estaban instaladas en el entorno local.
- `tooling/`: scripts de instalación y compilación reproducible del repositorio.
- `revision/DEPENDENCIAS.md`: versiones, función y clasificación de dependencias.
- `revision/HALLAZGOS.md`: resultados de la revisión y contradicciones detectadas.
- `revision/CONTENIDO.txt`: inventario de archivos del paquete.
- `revision/SHA256SUMS.txt`: checksums de todos los archivos, salvo el propio
  archivo de checksums.

## Seguridad

No se incluyeron:

- `vitalwatch_config.h`;
- `.env*`, tokens, claves o contraseñas;
- directorios `build/`;
- binarios `.bin`, `.elf` o `.map`.

Los binarios existentes de 1.0.8 contienen los cuatro valores de configuración
privada (`SUPABASE_URL`, `SUPABASE_KEY`, `DEVICE_CODE` y `DEVICE_TOKEN`), por lo
que no son aptos para compartir. Para compilar, copie
`vitalwatch_config.example.h` como `vitalwatch_config.h` y complete los valores
en un entorno privado.

## Lectura recomendada

1. `firmware/VitalWatch_BIOSYS_1_0_8/README.md`.
2. `firmware/VitalWatch_BIOSYS_1_0_8/MANIFEST.md`.
3. `firmware/VitalWatch_BIOSYS_1_0_8/CAMBIOS_1_0_8.md`.
4. `firmware/VitalWatch_BIOSYS_1_0_8/VALIDACION_IMU_1_0_8.md`.
5. `revision/HALLAZGOS.md`.

## Reproducción del entorno

Los scripts del directorio `tooling/` conservan las versiones fijadas en el
repositorio. En el proyecto completo se ejecutan desde su raíz. El instalador
descarga Arduino CLI `1.5.1`, ESP32 Arduino Core `3.3.11` y las dependencias
directas. Las copias de `libraries/` permiten auditar el código sin depender de
la descarga, pero el script oficial sigue siendo la fuente de instalación.

Este baseline es experimental y no tiene validación clínica.
