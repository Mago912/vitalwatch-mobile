# VitalWatch VW-BIO 0.6.0

Perfil de validacion biomédica para ESP32, MAX30102, MPU6050 y ST7735. Deriva
del baseline funcional FW 0.5.0 y aplica el contrato autorizado por Biomedical
Algorithms Lab. No contiene WiFi, medicacion, Supabase ni control remoto.

## Versionado

- `VW-SYS 0.9.1`: sistema integral conectado, en
  `../VitalWatch_FW_0_9_1/`.
- `VW-BIO 0.6.0`: adquisicion, calidad, resultados HR/SpO2, movimiento,
  instrumentacion y replay, en esta carpeta.

Son ejes distintos. Este sketch muestra `Target VW-SYS 0.9.1` para indicar el
sistema al que se destinaria una integracion futura, no para afirmar que el
codigo conectado ya incorpora esta rama biomédica.

## Compilar

```powershell
npm run firmware:bio:build
npm run firmware:bio:research
npm run firmware:bio:replay
```

## Cargar manualmente en el ESP32

```powershell
npm run firmware:bio:upload
npm run firmware:bio:research:upload
npm run firmware:bio:replay:upload
```

Cada comando compila y carga un perfil completo. Cargar VW-BIO sustituye el
VW-SYS que esté instalado; no se instala por encima ni se combina en la flash.
Para volver al sistema conectado y a la app, ejecutar
`npm run firmware:upload`.

El modo normal deja desactivado el logger. Research genera CSV no bloqueante.
Replay espera por Serial lineas con:

```text
sample_index,sample_time_us,red_raw,ir_raw,timing_valid
```

Enviar `RESET` reinicia el pipeline. El replay usa
`PPGService::processReplaySample()`, que llama a las mismas funciones
matematicas que las muestras de hardware.

## Estado

- Compilacion normal: aprobada con ESP32 core 3.3.11.
- Compilacion research + replay: aprobada.
- Prueba con sensores, TFT y botones reales: `HARDWARE_VALIDATION_REQUIRED`.
- Validacion de exactitud biomédica: requiere dataset etiquetado; no es un
  dispositivo médico validado.

Vease `FIRMWARE_MANIFEST.md`, `MODULES.md` y `CHANGES.md`.
