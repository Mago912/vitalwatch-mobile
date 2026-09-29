# Cambios de BIOSYS 1.0.16

## Resumen

BIOSYS 1.0.16 introduce el experimento `PPG-DUAL-CHANNEL-A` y publica FC sólo
cuando el pipeline completo alcanza **validez técnica**. Esta validez técnica no constituye validación clínica y no reemplaza una medición médica certificada.

## Detector por canal

- FIR corto de 7 muestras menos FIR largo de 20 muestras.
- Calibración adaptativa de ruido y señal.
- Umbral candidato sensible, separado de la decisión de validez.
- Supresión no máxima de 320 ms para seleccionar un pulso dominante.
- Rechazo de prominencias superiores a seis veces la mediana fusionada.
- Memoria fija; no se agregan asignaciones dinámicas al ciclo PPG.

## Fusión y frecuencia cardíaca

- Cada pulso requiere candidatos rojo e IR dentro de 120 ms.
- Los pulsos de un solo canal nunca autorizan `VALID`.
- El historial conserva hasta ocho IBI entre 330 y 1.600 ms.
- La FC robusta usa la mediana de IBI.
- Para publicar se exigen al menos seis IBI, MAD/mediana ≤ 0,12 y rango total
  ≤ 300 ms.

## Barreras de seguridad técnica

- SNR mínimo 1,50 en ambos canales.
- Al menos seis coincidencias rojo/IR en la ventana.
- Cinco segundos continuos sin artefactos.
- Cuarentena de cuatro segundos ante movimiento sostenido/severo, saturación,
  salto óptico, tiempo inválido o muestras perdidas.
- La pérdida de contacto, un `RESET` o una cuarentena eliminan inmediatamente
  la FC publicada y reinician el pipeline cuando corresponde.

## Diagnóstico y pruebas

- Se añadieron columnas de prominencia, umbral, SNR, candidatos, fusión, estado,
  cuarentena y sincronización al modo de investigación.
- Se añadió un protocolo de replay Serial con resumen estructurado.
- 23 autotests físicos pasaron en el ESP32 real.
- Cuatro datasets inmutables fueron reproducidos como **CODEX REPRODUCTION
  TESTS**, no como tests originales de Cowork.
- La captura estable histórica produjo 12.600 ms continuos válidos y mediana de
  86 lpm, sin publicaciones inseguras ni por canal único.
- El detalle y las limitaciones están en
  `RESULTADOS_PPG_DUAL_CHANNEL_A_2026-09-24.md`.

## Compatibilidad e integridad

- Producto: BIOSYS 1.0.16.
- Componentes: SYS 0.9.9 + BIO 0.7.0.
- App actual del repositorio: 1.0.12.
- `Sensor_Movimiento.cpp`, `Sensor_Movimiento.h` y `PpgSampleTimeline.h` son
  idénticos a BIOSYS 1.0.15.
- No se cambiaron pines, buses, TFT, red, medicamentos, mensajería ni lógica de
  caídas.

## Memoria

| Perfil | Flash usada | RAM global | Tamaño `.bin` | SHA-256 del `.bin` |
|---|---:|---:|---:|---|
| Producto | 1.183.772 B | 56.560 B | 1.183.920 B | `DB42D196777ADA4804F68CD1CC98F4037AE4BD53591B7F97DFD3F341373CCED0` |
| Investigación | 1.186.452 B | 60.880 B | 1.186.608 B | `F14C2DB67D0FF1683D36BD846619C6D119E447B61BA39ABD412A9433CF2CA2E4` |
| Replay | 486.680 B | 37.252 B | 486.832 B | `7F78CAA3B1F8614C5FAAF235DB2B7A7E0867F634CAC4D1962B69EBC059335953` |

Comparación research contra BIOSYS 1.0.15 (1.182.072 B de flash y 59.040 B de
RAM): +4.380 B de flash y +1.840 B de RAM. Ambos valores están dentro de los
límites aprobados de +12.288 y +2.048 bytes, respectivamente.

El buffer CSV se mantuvo en 768 bytes: las capturas físicas 1.0.15 tuvieron una
fila máxima de 304 caracteres y los doce campos nuevos conservan margen amplio.
Esto recuperó 256 bytes de RAM sin cambiar el detector ni truncar el esquema.
