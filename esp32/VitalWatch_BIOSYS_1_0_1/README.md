# VitalWatch BIOSYS 1.0.1

Firmware unificado y trazable para la pulsera VitalWatch:

- Producto: `VW-BIOSYS 1.0.1`
- Subsistema operativo y conectado: `VW-SYS 0.9.2`
- Subsistema biomédico: `VW-BIO 0.6.0`
- Aplicación acompañante: `VitalWatch 1.0.4`

BIOSYS no es una concatenación de dos programas. Usa la navegación, WiFi, medicación, control remoto, SOS y telemetría de SYS, pero sustituye su capa de sensores por los servicios PPG e IMU auditables de BIO. Así existe una sola pantalla, un solo estado global, un solo bus I²C y una sola instancia de cada sensor.

## Estado

- Compilación Arduino CLI: aprobada.
- Ocupación normal: 1.160.984 bytes de flash (88 %) y 53.872 bytes de RAM estática (16 %).
- Prueba física completa: pendiente.
- Validación clínica: no realizada; no es un dispositivo médico certificado.

## Compilar

Desde la raíz de `vitalwatch-mobile`:

```powershell
npm run firmware:biosys:build
```

El binario queda en `.arduino/build/biosys-1.0.1/`.

## Corrección 1.0.1

- Recibe la entrada `OK` solicitada por la app 1.0.4.
- Solo usa el OK remoto para reconocer una alerta activa; no navega pantallas normales.
- Reporta si la TFT muestra `none`, `fall` o `sos`.
- Confirma a Supabase cuando la entrada remota fue procesada.

## Cargar al ESP32

La carga requiere un `vitalwatch_config.h` privado completo. El archivo no debe compartirse ni incluirse en ZIP públicos.

```powershell
npm run firmware:ports
npm run firmware:biosys:upload -- -Port COM3
```

Si la placa no entra automáticamente al cargador: mantener pulsado `IO0/BOOT`, iniciar la carga, soltarlo cuando aparezca `Connecting...` y pulsar `EN/RESET` al finalizar solamente si la placa no reinicia por sí sola.

## Investigación biomédica opcional

```powershell
npm run firmware:biosys:research
```

Esta variante activa CSV de laboratorio por Serial. No es la variante normal de producto y no debe usarse para evaluar autonomía o fluidez de interfaz.

## Documentos para revisión

- `MANIFEST.md`: identidad, dependencias, tamaño y estado de validación.
- `ARQUITECTURA_Y_BLOQUES.md`: explicación detallada de los bloques marcados en código.
- `GUIA_REVISION_ARCHIVOS.md`: orden recomendado para revisar archivo por archivo.
- `CAMBIOS_DESDE_SYS_Y_BIO.md`: integración, sustituciones y elementos no incorporados.
- `VALIDACION_HARDWARE.md`: protocolo de prueba en placa y con la app.

No editar umbrales biomédicos sin registrar una nueva versión BIO y evidencia de prueba reproducible.
