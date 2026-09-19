# Captura biomédica del laboratorio

## Advertencia

Este sistema es experimental, no es un dispositivo médico validado y sus
resultados no deben usarse para diagnóstico o decisiones clínicas.

## Requisitos

- ESP32 cargado con el firmware de esta carpeta.
- Cable USB de datos.
- Python 3.
- `pyserial==3.5` (`python -m pip install -r tools/requirements.txt`).
- Puerto serie libre: cierre el monitor serie del Arduino IDE antes de capturar.

El firmware usa **460800 baudios**. Se eligió para dar margen al modo `FULL` a
25 muestras/s. El modo arranca en `OFF` en cada reinicio.

## Inicio rápido

Desde `Laboratorio_Pruebas_MAX30102_2026-09-17`:

```powershell
python tools/capture_biomed.py --list-ports
python tools/capture_biomed.py --port COM5 --mode FULL --test-id reposo --subject-id P001
```

Cambie `COM5`, `reposo` y `P001` por los valores reales. Los identificadores
aceptan letras, números, punto, guion y guion bajo; máximo 31 caracteres.

Durante la captura se pueden escribir:

```text
BIO MARK dedo_colocado
BIO REF HR 72
BIO REF SPO2 98
BIO STATUS
STOP
```

`REF` solo registra una referencia manual. No calibra ni modifica el algoritmo.
`STOP` envía `BIO TEST STOP`, espera la cola final y cierra los archivos.

Para una sesión temporizada y sin entrada interactiva:

```powershell
python tools/capture_biomed.py --port COM5 --mode RAW --test-id quieto_60s --subject-id P001 --duration 60 --no-stdin
```

## Comandos directos del firmware

```text
BIO HELP
BIO MODE OFF|RAW|FULL
BIO TEST START <test_id> <subject_id>
BIO TEST STOP
BIO MARK <tag>
BIO REF HR|SPO2 <valor>
BIO STATUS
```

Los comandos antiguos de un carácter (`0`…`5`, `P`, `R`, `I`) siguen
disponibles. Los comandos `BIO` requieren fin de línea.

## Registros serie

- `@VW_META`: pares clave/valor de trazabilidad y configuración.
- `@VW_RAW`: una muestra PPG con secuencia, ambos tiempos, integridad e IMU.
- `@VW_EVT`: inicio, fin, marcas y pérdidas de adquisición.
- `@VW_REF`: referencia manual externa.
- `@VW_STAT`: estado de cola y contadores de pérdida.
- `[INFO]`, `[WARN]`, `[ERROR]`: texto humano; se conserva solo en el log crudo.

`sample_time_us` es estimado a período constante. `service_time_us` indica
cuándo el firmware atendió la tanda. No son equivalentes.

## Archivos de cada sesión

Cada ejecución crea `RAW/AAAAMMDD_HHMMSS_test_subject/` con:

- `metadata.json`: datos del host y metadatos declarados por el firmware;
- `samples.csv`: RAW y, en FULL, campos derivados;
- `events.csv`: eventos del dispositivo y errores de parser del host;
- `reference.csv`: referencias manuales;
- `status.csv`: fotografías de contadores;
- `session_summary.json`: totales, huecos y duplicados observados;
- `serial_raw.log`: bytes recibidos, conservados antes de parsear.

## Prueba recomendada inicial

1. Encender sin dedo y capturar 20 s.
2. Marcar `dedo_colocado` y apoyar el dedo sin presión excesiva durante 90 s.
3. Registrar referencias HR/SpO₂ si existe un instrumento externo.
4. Marcar `dedo_retirado`, esperar 20 s y detener.
5. Verificar que `corrupt_protocol_lines`, `duplicate_sequences` y
   `logger_drop_total` sean cero; cualquier hueco debe coincidir con un evento
   `ACQUISITION_LOSS` y sus contadores.

Para una captura comparada con un pulsioximetro, siga
`07_PROTOCOLO_REFERENCIA_MAX30102.md`. Al terminar puede generar el informe con:

```powershell
python tools/analyze_reference.py RAW\CARPETA_DE_LA_SESION
```

Una discrepancia no debe ocultarse ni corregirse a mano en el CSV: conserve
`serial_raw.log` y repita con condiciones anotadas.
