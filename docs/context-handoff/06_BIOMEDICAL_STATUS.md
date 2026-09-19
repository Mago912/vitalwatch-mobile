# VITALWATCH — BIOMEDICAL STATUS

## Actualización 2026-09-01

La implementación histórica descrita más abajo sigue presente dentro de
`VW-SYS 0.9.1`. En paralelo existe `VW-BIO 0.6.0` en
`esp32/VitalWatch_BIO_0_6_0/`: separa HR/SpO2, instrumenta timing/FIFO/IMU,
aplica `MaximValid AND quality`, usa dirty rectangles y ofrece CSV/replay.
Compila normal y research/replay, pero sigue `EXPERIMENTAL` hasta validación
física y dataset. No asumir que SYS ya incorpora BIO.

## Aviso obligatorio

VitalWatch es un prototipo académico y experimental. No posee validación
clínica y no debe usarse para diagnóstico, decisión terapéutica ni sustitución
de un oxímetro, ECG o sistema profesional de detección de caídas.

# CURRENT IMPLEMENTATION

## MAX30102 y adquisición PPG

| Elemento | Implementación | Estado |
| --- | --- | --- |
| Sensor | MAX30102, I²C `0x57` | `WORKING — U` detección |
| Librería | SparkFun MAX3010x, clase `MAX30105` | `WORKING — F` |
| Canales | IR y rojo | `WORKING — F` |
| Procesamiento | continuo, independiente de la pantalla | `WORKING — F, U` |
| Resultado biomédico | BPM y SpO₂ | `EXPERIMENTAL — F` |

El loop procesa como máximo ocho muestras FIFO por pasada para no monopolizar
CPU ni retrasar la IMU.

## Máquina de estado PPG

```text
SIN_CONTACTO
      ↓ dedo detectado
CALIBRANDO (3.2 s)
      ↓
MIDIENDO (20 s guiados)
      ├──► RESULTADO
      └──► SENAL_INSUFICIENTE

SENSOR_NO_DISPONIBLE si falla el hardware
```

Al retirar el dedo vuelve a `SIN_CONTACTO`, pero conserva el último resultado
para mostrarlo como referencia.

## Detección de dedo y ganancia

Valores actuales, heredados desde `0.5.0`:

| Parámetro | Valor |
| --- | --- |
| umbral de dedo | IR `14,000` |
| umbral de retiro | IR `8,500` |
| inicio de autoganancia | IR `7,000` |
| objetivo IR mínimo | `38,000` |
| objetivo IR máximo | `90,000` |
| potencia LED inicial | `0x70` |
| rango de LED | `0x35` a `0xC0` |
| paso de LED | `0x10` |
| ajuste de ganancia | cada 450 ms |

Estos valores son `EXPERIMENTAL`. No se encontró un informe de calibración con
personas, tonos de piel, movimiento, presión del dedo o comparación contra un
equipo de referencia.

## BPM

Hay dos rutas:

1. detector de picos/latidos propio sobre IR filtrado;
2. resultado del algoritmo SparkFun usado en la ventana de SpO₂.

Parámetros principales:

- intervalos válidos: 330 a 1,600 ms, aproximadamente 38–182 lpm;
- historial: 8 intervalos;
- mediana y estabilidad antes de aceptar;
- fallback aproximado cuando no alcanza criterio estable;
- resultado marcado válido/aproximado.

La app considera alerta a partir de 100 lpm y SOS a partir de 110 lpm cuando
interpreta datos remotos. Esas reglas de UI no constituyen criterio médico.

Estado: `EXPERIMENTAL — F`.

## SpO₂

Implementación:

- ventana de 100 muestras;
- actualización con 25 nuevas muestras;
- decimación por 4;
- algoritmo `maxim_heart_rate_and_oxygen_saturation` de la librería SparkFun;
- historial de 5 valores;
- mediana y estabilidad;
- fallback aproximado si la señal no cumple todos los criterios.

La app considera alerta a 94% o menos y SOS a 92% o menos. Son umbrales de
demostración, no recomendación clínica.

Estado: `EXPERIMENTAL — F`.

## Calidad de señal

El firmware calcula indicadores de señal IR/roja, perfusión y relación entre
canales. Clasifica:

```text
SIN_DATOS
BAJA
MEDIA
BUENA
```

La TFT muestra “LECTURA ESTABLE” o “LECTURA EXPERIMENTAL”. Esa etiqueta describe
la estabilidad interna del algoritmo, no precisión médica.

## Antigüedad y telemetría

Un resultado PPG solo se envía como válido si:

- su bandera individual es válida; y
- tiene como máximo 60 s de antigüedad.

Si no cumple, el firmware envía `null` en lugar de inventar un número. Este
comportamiento fue observado en la primera prueba real — `WORKING — U`.

## Movimiento e impacto

El firmware mide:

- aceleración tridimensional;
- magnitud en g;
- cambio de magnitud;
- giro en rad/s;
- cambio de giro.

Umbrales experimentales:

| Parámetro | Valor |
| --- | --- |
| impacto fuerte | 1.70 g |
| impacto moderado | 1.32 g |
| variación de aceleración | 0.48 g |
| giro | 1.15 rad/s |
| variación de giro | 0.70 rad/s |
| bloqueo de nuevo impacto | 1.4 s |

El muestreo objetivo es 100 Hz. Un evento puede activar alerta visual y enviar
`fall_detected`, pero no se encontró validación que distinga caída real de
movimiento cotidiano.

Estado: `EXPERIMENTAL — F`.

# APPROVED IMPROVEMENTS

“Aprobada” aquí significa compatible con las decisiones ya registradas; no
significa clínicamente validada.

1. Mantener procesamiento PPG e IMU siempre activo — `R`.
2. Mantener valores inválidos como nulos, nunca inventados — `R`.
3. Registrar calidad, flags de validez y timestamp junto al valor — `R`.
4. Comparar contra equipos de referencia en pruebas controladas — `R`.
5. Cambiar umbrales/filtros solo con datos del Biomedical Algorithms Lab — `R`.
6. Preservar el algoritmo actual como baseline antes de experimentar — `R`.
7. Separar “impacto detectado” de “caída confirmada” en textos y datos — `R`.

# PENDING VALIDATION

## MAX30102

- repetir detección y estabilidad tras reinicios;
- comprobar contacto, posición y presión del dedo;
- registrar señal cruda controlada;
- evaluar ruido por alimentación y movimiento.

## BPM

- comparar varias sesiones contra referencia;
- medir error, dispersión y tiempo hasta resultado;
- evaluar reposo y movimiento;
- comprobar falsos latidos.

## SpO₂

- comparar con oxímetro de referencia;
- evaluar rango de saturaciones solo en condiciones éticas/seguras;
- revisar efecto de perfusión, tono de piel, temperatura y movimiento;
- validar el fallback o eliminarlo si induce falsa confianza.

## Impacto/caída

- crear protocolo seguro sin golpes al hardware ni personas;
- medir actividades normales y eventos controlados;
- calcular falsos positivos/negativos;
- considerar secuencia de caída, inmovilidad y confirmación del usuario.

## Telemetría

- confirmar que datos nulos no sustituyen valores anteriores de manera
  engañosa en la app;
- registrar calidad/validez en la base si se requiere análisis;
- comprobar reintentos y pérdida de red.

## Trazabilidad

No se encontraron datos de laboratorio, datasets, tablas de comparación ni
versionado separado de parámetros biomédicos. Crear estos artefactos antes de
afirmar mejoras de precisión — `P`.

## Preservar sin motivo

Los archivos `Sensor_Oxigeno.h` y `Sensor_Movimiento.h` tienen el mismo contenido
en las versiones `0.5.0` a `0.9.1`. Esto los convierte en un baseline claro. No
modificarlos durante tareas de UI, WiFi, medicamentos o documentación.

La fuente 0.9.1 entregada conserva ambos algoritmos sin cambios — F. Sus hashes
SHA-256 son:

```text
Sensor_Oxigeno.h    6F29339C7A1B331CAB2776B925E9CC5B35CDDFBE050AD0DD9CE0FE4234B57570
Sensor_Movimiento.h AFDCC53B608572A3BF355777751BF663F2B20B15F66E2FB19AE3DF8EF734A7F2
```
