# 00 — Análisis previo del laboratorio MAX30102

> **EXPERIMENTAL — NO ESTABLE — NO ES UNA NUEVA VERSIÓN DE BIOSYS**

## 1. Punto de partida verificado

- Baseline: BIOSYS 1.0.8 / SYS 0.9.8 / BIO 0.6.3.
- ZIP: `VitalWatch_BIOSYS_1_0_8_Cowork_2026-09-17.zip`.
- SHA-256 verificado: `cef0be067ca84ee40eb9a0a3aa3457b9b62f73e07b266f283e6675fcbdbe3186`.
- Contenido: 728 archivos y sus directorios.
- `FINAL_BIOMED_CANDIDATE`: **NOT_AVAILABLE**.
- Las pruebas de esta carpeta son **CODEX REPRODUCTION TESTS**, no pruebas
  originales de Cowork.

El ZIP original no se modifica. La copia experimental se compilará con un
nombre distinto y no se promoverá a estable sin autorización del equipo.

## 2. Objetivo de esta etapa

El objetivo no es producir un BPM más atractivo. Queremos poder explicar qué
datos entregó el MAX30102, cuándo se leyeron, cuáles se perdieron y qué hizo el
algoritmo actual con ellos.

`RAW` significa los valores originales rojo e infrarrojo recibidos del sensor
antes de los cálculos biomédicos importantes. El archivo RAW no se rellenará,
interpolará, duplicará ni suavizará.

## 3. Términos fundamentales

### FIFO

**Explicación simple:** pequeña memoria en forma de fila. El sensor coloca
mediciones al final y el ESP32 retira primero la más antigua.

**Definición técnica:** cola First-In, First-Out. El MAX30102 tiene una FIFO
física y la biblioteca SparkFun agrega otro buffer circular en RAM.

**Por qué importa:** si cualquiera se llena o se administra mal, se pierden o
desordenan muestras.

### Buffer circular

**Explicación simple:** conjunto fijo de casilleros reutilizados en círculo.

`head` señala dónde escribe la biblioteca y `tail` cuál será el siguiente dato
leído. Si sólo se comparan ambos índices, `head == tail` puede confundirse entre
"vacío" y "lleno".

### Sample o muestra

Una pareja de valores RED/IR adquirida en un instante. RED es el canal de luz
roja e IR el infrarrojo.

### Timestamp

Número que indica el momento asociado a una muestra. El MAX30102 no entrega un
timestamp propio: BIOSYS lo estima usando la tasa configurada.

### Sample rate y averaging

`sample rate` es la velocidad de conversión del sensor. `averaging` promedia
varias conversiones. En el baseline: 100 Hz y average 4, por lo que llegan
aproximadamente 25 registros FIFO por segundo, uno cada 40.000 microsegundos.

### Overflow, gap y drop

- `overflow`: una memoria se llenó y un dato fue sobrescrito.
- `gap`: falta un índice en la secuencia esperada.
- `drop`: dato descartado por hardware, software o logger.

Nunca se interpretarán como una muestra válida.

### I2C y lectura corta

I2C es el bus de dos cables usado por MAX30102 e IMU. Una lectura corta ocurre
cuando se solicitan, por ejemplo, seis bytes y llegan menos. El baseline no
comprueba esa cantidad dentro del driver SparkFun.

### Rollover

El contador `micros()` de 32 bits llega a su máximo y vuelve a cero,
aproximadamente cada 71,58 minutos. Convertirlo a 64 bits después del reinicio
no recupera automáticamente la época anterior.

### Latencia, jitter y backpressure

- `latencia`: demora entre adquirir y procesar/transmitir.
- `jitter`: variación de esa demora o del intervalo esperado.
- `backpressure`: el productor genera datos más rápido de lo que el logger
  puede enviarlos. El logger debe contabilizar el descarte, no frenar al sensor.

### PPG, beat, IBI y BPM

- PPG: señal óptica producida por cambios de volumen sanguíneo.
- beat: evento que el algoritmo considera pulso.
- IBI: tiempo entre dos beats aceptados.
- BPM: latidos por minuto, calculados a partir del IBI.

### SpO2 y AC/DC

SpO2 es una estimación experimental de saturación. AC representa la parte
pulsátil de la señal y DC su nivel medio. Esta etapa no modifica el algoritmo,
coeficientes ni calibración de SpO2.

## 4. Archivos que participan realmente

| Archivo | Responsabilidad |
|---|---|
| `VitalWatch_BIOSYS_1_0_8.ino` | Ejecuta continuamente IMU, PPG, UI y red |
| `Sensor_Oxigeno.cpp/.h` | Adquisición PPG, timestamps, contacto, beats, BPM y SpO2 |
| `BioResearch.cpp/.h` | Logger de investigación heredado; será reemplazado en la copia experimental |
| `Sensor_Movimiento.cpp/.h` | Proporciona un único snapshot IMU; no se duplicará la lectura |
| `I2CBusService.cpp/.h` | Propietario del bus I2C compartido |
| `SystemState.cpp/.h` | Métricas de loop, pantalla e I2C |
| `MAX30105.cpp/.h` | Driver SparkFun, FIFO software y lectura I2C |
| `heartRate.cpp/.h` | Detector SparkFun `checkForBeat()` |
| `spo2_algorithm.cpp/.h` | Algoritmo Maxim heredado de SpO2/HR |

No se tocarán app, UI, caídas, SOS, medicación, red, energía o credenciales.

## 5. Viaje real de una muestra

```text
MAX30102 (conversión óptica RED + IR)
  ↓
FIFO física de 32 posiciones del sensor
  ↓
MAX30105::check()
  ↓ I2C
buffer circular SparkFun de 4 posiciones
  ↓ getFIFORed/getFIFOIR/nextSample
PPGService::update()
  ↓ sequence + timestamp estimado + timingValid
processSample()
  ├─ contacto y autoganancia
  ├─ processPeaks()
  │    ├─ candidato propio
  │    ├─ checkForBeat() SparkFun
  │    └─ beat aceptado
  ├─ IBI → BPM instantáneo/robusto
  ├─ pushSpO2() → ventana → algoritmo Maxim
  └─ BioResearch::logPPG()
       ↓
Serial / captura en PC
```

La hora de adquisición y la hora de procesamiento no son iguales. La primera
es estimada para la muestra; la segunda es cuando el ESP32 efectivamente
ejecuta el algoritmo.

## 6. Localización de IRR-001 a IRR-006

### IRR-001 — orden FIFO

`MAX30105::check()` incrementa `sense.head` antes de escribir. Los getters leen
`sense.tail` antes de que `nextSample()` lo avance. Con índices iniciales cero,
la primera lectura puede provenir del casillero cero sin inicializar mientras
la muestra nueva está en el casillero uno.

**Estado previo a test:** confirmado por inspección; reproducción pendiente.

### IRR-002 — lleno confundido con vacío

`available()` calcula solamente `(head-tail) mod 4`. Cuatro escrituras llevan
`head` nuevamente a `tail`, por lo que informa cero aunque llegaron cuatro
muestras.

**Estado previo a test:** confirmado por inspección; reproducción pendiente.

### IRR-003 — lectura I2C corta

`requestFrom()` no se compara con los bytes solicitados. Si `read()` devuelve
`-1`, se almacena como byte `255`; tres bytes `255` forman `0xFFFFFF` y la
máscara de 18 bits lo convierte en `0x3FFFF` (`262143`), un valor que parece
una saturación real.

**Estado previo a test:** confirmado por inspección; reproducción pendiente.

### IRR-004 — timestamps reanclados por tanda

Cada llamada toma un nuevo `micros()` como hora de la muestra más reciente y
resta intervalos de 40.000 us. Conserva el espaciado dentro de una tanda, pero
no la fase entre tandas ni la latencia real del FIFO.

Los timestamps del laboratorio deberán marcarse `ESTIMATED`.

**Estado previo a test:** confirmado por inspección; magnitud física pendiente.

### IRR-005 — rollover

El baseline convierte `micros()` a `uint64_t` después de haberlo obtenido como
contador de 32 bits. Tras el rollover, el valor retrocede y una resta de 64
bits puede producir una diferencia enorme.

**Estado previo a test:** confirmado aritméticamente; reproducción pendiente.

### IRR-006 — pérdidas incompletamente registradas

El contador físico de overflow se lee, pero no invalida `timingValid`. Tampoco
existen contadores separados para lectura corta, gap de secuencia y descarte
del logger.

**Estado previo a test:** confirmado por inspección; prueba integrada pendiente.

## 7. Qué se modificará sólo si las pruebas lo confirman

- Copia local controlada del driver SparkFun: FIFO con ocupación explícita,
  orden correcto y lectura corta detectable.
- Extensión monotónica de `micros()` a 64 bits.
- Timestamp estimado continuo y etiquetado de su fuente.
- Contadores separados de pérdidas.
- Logger con modos OFF/RAW/FULL y comandos Serial START/STOP/MARK/REF/STATUS.
- Captura en PC con archivos estructurados y copia Serial exacta.

## 8. Qué no se modificará

- detector de beats;
- algoritmo HR o SpO2;
- configuración óptica;
- coeficientes;
- caídas, impacto o SOS;
- interfaz, menús, red, medicación o app;
- lectura independiente del MPU.

