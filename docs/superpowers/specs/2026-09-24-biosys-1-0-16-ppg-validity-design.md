# BIOSYS 1.0.16 — validez técnica de frecuencia cardíaca

Fecha: 2026-09-24  
Estado: diseño aprobado en conversación; pendiente de revisión de este documento

## 1. Objetivo

Crear una evolución controlada de VitalWatch que pueda publicar una frecuencia
cardíaca con estado `HeartRateStatus::VALID` cuando el MAX30102 entregue una
señal óptica internamente consistente, sin convertir ruido, movimiento o cambios
de contacto en una medición válida.

En esta etapa, `VALID` significa **validez técnica interna**. Requiere acuerdo
entre los canales rojo e infrarrojo, intervalos de pulso estables, contacto
continuo, temporización íntegra y ausencia de movimiento relevante. No significa
exactitud clínica ni sustituye una comparación futura contra ECG u oxímetro
comercial.

## 2. Versionado propuesto

| Componente | Versión | Motivo |
|---|---:|---|
| Producto combinado | BIOSYS 1.0.16 | Nueva versión instalable y auditable |
| Sistema | SYS 0.9.9 | Sin cambios funcionales |
| Biomédico | BIO 0.7.0 | Cambio de arquitectura del detector de FC |
| Algoritmo HR | `0x0700` | Detector rojo/IR y puerta de validez nuevas |
| Experimento | `PPG-DUAL-CHANNEL-A` | Identificador visible en telemetría research |

El perfil `BIO_RESEARCH_MODE` conserva LED rojo e IR fijo en `0x35` para que la
primera comparación física cambie el algoritmo, no la potencia óptica. El modo
normal conserva su autoganancia actual.

## 3. Evidencia de partida

La especificación se apoya en capturas propias; no utiliza ni atribuye tests a
Cowork.

| Dataset | Uso |
|---|---|
| `20260924-191425-sin-dedo-led-range-a.csv` | Control negativo sin dedo |
| `20260924-194014-dedo-quieto-timeline-a-toma-1.csv` | Control positivo interno: señal periódica rojo/IR, 83,2 lpm espectrales exploratorios |
| `20260924-195431-dedo-quieto-led-35-timeline-a-toma-1.csv` | Contacto y DC estables, amplitud relativa baja |
| `20260924-195710-dedo-quieto-led-35-timeline-a-toma-2.csv` | Cambios de contacto y contaminación del umbral |

La reconstrucción temporal de BIOSYS 1.0.15 queda congelada: 25 registros/s y
`40000 us` entre secuencias consecutivas sin pérdidas. Los cambios de 1.0.16 no
pueden alterar `PpgSampleTimeline`.

El detector anterior usa pisos absolutos (`prev1 > 8`, amplitud mínima `25`) y
actualiza `pulseAmpEma` con picos aceptados aunque sean artefactos. En la toma
estable LED `0x35`, 173 de 224 máximos locales fueron rechazados por esos pisos;
en la toma con cambio de contacto, una amplitud extrema elevó el umbral durante
la recuperación. Estos son los defectos raíz que debe corregir el diseño.

## 4. Alcance

### Incluido

- Detector adaptativo independiente para rojo e IR.
- Fusión temporal de candidatos de ambos canales.
- Puerta explícita de validez técnica.
- Cuarentena y recuperación después de movimiento o transición óptica.
- Entrada de movimiento de solo lectura desde `MotionService`.
- Replay por Serial usando el pipeline real del firmware.
- Pruebas reproducibles identificadas como `CODEX REPRODUCTION TESTS`.
- Diagnósticos suficientes para explicar por qué una lectura no es válida.

### Excluido

- Cambios en adquisición, calibración o detección de caídas del MPU6050/6500.
- Cambio de pines, buses I2C, pantalla, botones, red, Supabase o aplicación.
- Publicación clínica de SpO2.
- Calibración de exactitud de FC contra una referencia externa.
- FFT como estimador principal de FC.
- Retocar el LED durante la primera validación física de 1.0.16.

## 5. Arquitectura

### 5.1 `PpgChannelDetector`

Componente determinista y sin asignación dinámica. Existirá una instancia para
rojo y otra para IR. Cada instancia recibe una muestra y produce, como máximo,
un candidato de pulso.

Responsabilidades:

- estimar DC con el filtro existente `dc += 0.010 * (raw - dc)`;
- filtrar AC con `filtered += 0.22 * (ac - filtered)`;
- localizar máximos y valles locales;
- calibrar ruido y señal usando prominencias relativas;
- producir amplitud, timestamp y nivel de confianza del candidato;
- rechazar amplitudes extremas sin incorporarlas al modelo adaptativo.

No conoce BPM, estado de contacto, MPU, UI ni telemetría.

### 5.2 `PpgBeatFusion`

Recibe candidatos rojo e IR. Un pulso fusionado solo existe si los candidatos
de ambos canales quedan separados por no más de `120 ms`. El timestamp del
pulso es el promedio de ambos timestamps.

Aplica un periodo refractario de `330 ms`. Un intervalo mayor que `1600 ms`
rompe la continuidad y limpia el historial de IBI antes de iniciar una secuencia
nueva. Solo los pulsos fusionados, no artefactados, pueden entrenar la amplitud
de señal o alimentar el historial de IBI.

SparkFun `checkForBeat()` continúa registrado como diagnóstico comparativo,
pero deja de tener autoridad para insertar por sí solo un IBI válido.

### 5.3 `PpgValidityGate`

Consume pulsos fusionados, calidad óptica, integridad temporal y una pista de
movimiento. Publica BPM y estado, pero nunca modifica los detectores.

Estados internos:

1. `CALIBRATING`: reúne `50` muestras después de estabilización o cuarentena;
2. `TRACKING`: acepta pulsos fusionados y construye IBI;
3. `TECHNICALLY_VALID`: se cumplen todas las barreras de validez;
4. `QUARANTINED`: artefacto confirmado; no se publica BPM y se reinician IBI;
5. `NO_CONTACT`: conserva el comportamiento público actual.

El estado interno no cambia los valores existentes de `HeartRateStatus`. Se
mapea a `INSUFFICIENT_DATA`, `UNSTABLE`, `VALID`, `LOW_QUALITY` o `NO_CONTACT`.

### 5.4 Adaptador de movimiento

Se añade una interfaz pequeña que desacopla PPG del MPU:

```cpp
struct PpgMotionHint {
  float accelerationDeltaG;
  float gyroMagnitudeRadS;
  bool saturated;
  bool valid;
};

void PPGService::setMotionHint(const PpgMotionHint &hint);
```

El `.ino` copia datos desde `MotionService::latest()` antes de actualizar PPG.
En replay, `BioReplay` suministra la misma estructura desde las columnas del
CSV. Ningún archivo `Sensor_Movimiento.*` será modificado.

### 5.5 Replay autoritativo

Se recupera para BIOSYS el camino `BIO_REPLAY_MODE` ya presente parcialmente en
la API. El replay se ejecuta sobre el ESP32 y llama a
`PPGService::processReplaySample()`, por lo que prueba el mismo código, tipos y
límites numéricos que se usarán con el sensor.

Protocolo de entrada:

```text
sample_index,sample_time_us,red_raw,ir_raw,timing_valid,
mpu_window_delta_g,mpu_window_gyro_rad_s,mpu_saturated
```

Comandos:

- `RESET`: reinicia contacto, detectores, calidad y contadores;
- `END`: emite un resumen único de filas, rechazos, pulsos fusionados,
  muestras `VALID`, primera validez, periodo válido continuo más largo y rango
  de BPM válido.

Un script PowerShell transforma los CSV de investigación, controla el puerto y
guarda salida y metadatos sin modificar las capturas originales.

## 6. Algoritmo de detección

### 6.1 Calibración por canal

Durante las primeras `50` muestras procesables, cada canal registra hasta `32`
prominencias de máximos locales en un anillo fijo. No emite candidatos.

Al terminar:

- referencia de ruido: mediana de la mitad inferior de prominencias;
- referencia de señal: percentil 75 de prominencias;
- umbral inicial: `ruido + 0.35 * (señal - ruido)`.

Si hay menos de cuatro máximos locales, el canal permanece en calibración y la
salida pública es `INSUFFICIENT_DATA`.

### 6.2 Seguimiento adaptativo

Un máximo local es candidato si es positivo y su prominencia es igual o mayor
que el umbral adaptativo. Se eliminan los pisos absolutos `8` y `25`.

- Un máximo rechazado actualiza solo la referencia de ruido con EMA `0.10`.
- Un pulso rojo/IR fusionado actualiza la referencia de señal con EMA `0.125`.
- Un candidato no fusionado no actualiza la referencia de señal.
- Una prominencia superior a seis veces la mediana de los últimos pulsos
  fusionados, cuando existan al menos cuatro, es artefacto y no entrena ningún
  modelo.
- El umbral siempre se recalcula como
  `ruido + 0.35 * max(0, señal - ruido)`.

Los anillos y ordenamientos tienen tamaño fijo. No se usa `new`, `malloc`,
`std::vector` ni recursión.

### 6.3 Detección de transición óptica

Una muestra provoca artefacto óptico inmediato si el cambio relativo respecto
a la muestra anterior supera `8 %` en rojo o IR:

```text
abs(actual - anterior) / max(anterior, CONTACT_THRESHOLD) > 0.08
```

También provoca artefacto una amplitud extrema definida en 6.2. La transición
óptica agrega `QR_OPTICAL_TRANSIENT` y entra en cuarentena.

### 6.4 Movimiento

Movimiento moderado existe cuando durante tres muestras PPG consecutivas se
cumple al menos una condición:

- `accelerationDeltaG >= 0.05 g`;
- `gyroMagnitudeRadS >= 0.10 rad/s`.

Movimiento severo es inmediato cuando:

- `accelerationDeltaG >= 0.20 g`; o
- `gyroMagnitudeRadS >= 0.75 rad/s`; o
- el MPU informa saturación.

Ambos casos agregan `QR_HIGH_MOTION` y activan cuarentena. Estos umbrales solo
deciden si la PPG es utilizable; no reemplazan ni modifican los umbrales de
caída del MPU.

### 6.5 Cuarentena y recuperación

Al entrar en `QUARANTINED`:

- se invalidan BPM y resultados retenidos;
- se limpian IBI, candidatos pendientes y referencias de señal;
- se conserva el diagnóstico de la causa;
- se exigen `4000 ms` continuos sin transición óptica ni movimiento antes de
  volver a `CALIBRATING`;
- después se ejecutan nuevamente las `50` muestras de calibración.

Un artefacto nuevo reinicia los `4000 ms`. No existe recuperación por timeout
que publique una FC sin haber pasado todas las barreras.

## 7. Regla de validez técnica

`HeartRateStatus::VALID` requiere simultáneamente:

1. contacto confirmado y DC sin saturación;
2. muestra con timing válido y ventana sin pérdidas;
3. estado fuera de calibración y cuarentena;
4. al menos seis IBI fusionados recientes;
5. BPM mediano entre `35` y `190` lpm;
6. desviación absoluta mediana de IBI dividida por la mediana `<= 0.12`;
7. rango máximo-mínimo de los IBI recientes `<= 300 ms`;
8. al menos seis de los últimos ocho pares candidatos sincronizados;
9. relación señal/ruido de prominencia `>= 1.5` en rojo e IR;
10. `5000 ms` continuos sin artefacto óptico, movimiento ni pérdida temporal.

La modulación RMS rojo/IR continúa como diagnóstico y protección de saturación,
pero su mínimo fijo anterior deja de ser una barrera única. Una señal de baja
amplitud puede ser válida solo si supera todas las comprobaciones temporales,
multicanal y de movimiento.

Si hay BPM calculable pero falta una barrera, la salida es `UNSTABLE` con BPM
solo cuando no exista artefacto activo. Durante baja calidad, cuarentena,
timing inválido o pérdida de contacto, BPM es `NAN`.

## 8. Diagnósticos y compatibilidad

Se agregan a `QualityReason`, manteniendo `uint16_t`:

```cpp
QR_OPTICAL_TRANSIENT   = 1u << 8,
QR_CHANNEL_MISMATCH    = 1u << 9,
QR_DETECTOR_CALIBRATING = 1u << 10
```

`QR_HIGH_MOTION` existente pasa a tener uso efectivo. Los valores anteriores no
cambian. La app puede ignorar bits nuevos y continúa recibiendo los mismos
campos de resultado.

Los diagnósticos research incorporan:

- prominencia y umbral rojo/IR;
- candidatos rojo/IR;
- pulso fusionado;
- estado interno del detector;
- milisegundos restantes de cuarentena;
- cantidad de pares sincronizados en la ventana;
- relación señal/ruido por canal.

## 9. CODEX REPRODUCTION TESTS

Todas las pruebas nuevas usarán esta identificación. No se llamarán Cowork
tests ni se afirmará equivalencia con artefactos no disponibles.

### 9.1 Ciclo RED inicial

Con el detector heredado y el replay ya conectado al pipeline real, el test de
la captura estable TIMELINE-A debe fallar porque produce cero muestras
`VALID`. Ese fallo demuestra que el test reproduce el problema original.

### 9.2 Controles negativos

- La captura sin dedo debe producir cero pulsos fusionados y cero `VALID`.
- Ninguna muestra con `timing_valid=0` puede ser `VALID`.
- Una transición óptica superior a `8 %` debe invalidar el resultado, limpiar
  IBI y abrir cuarentena.
- Movimiento severo debe producir `QR_HIGH_MOTION` y cero BPM hasta completar
  recuperación.
- Un tren sintético presente en un solo canal debe producir
  `QR_CHANNEL_MISMATCH` y cero `VALID`.

### 9.3 Control positivo interno

En `20260924-194014-dedo-quieto-timeline-a-toma-1.csv`, después de contacto,
estabilización y calibración:

- debe existir al menos un tramo `VALID` continuo de `10000 ms`;
- la mediana de BPM válidos debe quedar entre `75` y `95` lpm;
- rojo e IR deben contribuir a cada pulso usado para esos BPM;
- no se permiten muestras válidas con flags de timing, movimiento o transición
  óptica.

El intervalo 75–95 lpm verifica consistencia con la periodicidad interna
observada de 83,2 lpm; no afirma exactitud clínica.

### 9.4 Contacto estable con LED alto

`20260924-195431-dedo-quieto-led-35-timeline-a-toma-1.csv` no está obligado a
ser `VALID`. Puede terminar en `LOW_QUALITY` o `UNSTABLE` si los canales no
cumplen acuerdo y SNR. El test exige que ningún BPM válido provenga de un pulso
de un solo canal.

### 9.5 Cambios de contacto

En `20260924-195710-dedo-quieto-led-35-timeline-a-toma-2.csv`:

- cada transición óptica detectada debe abrir cuarentena;
- no debe haber `VALID` durante la cuarentena ni calibración posterior;
- una amplitud extrema no puede elevar permanentemente el umbral;
- el detector debe volver a calibración tras cuatro segundos estables, aunque
  la señal posterior todavía pueda permanecer no válida.

### 9.6 Regresiones

- Hash SHA-256 idéntico a BIOSYS 1.0.15 para `Sensor_Movimiento.cpp` y
  `Sensor_Movimiento.h`.
- Todos los intervalos consecutivos del replay conservan el timestamp del CSV.
- Builds normal, research y replay deben compilar.
- Las pruebas existentes de firmware y app deben continuar pasando.

## 10. Presupuesto y límites

Baseline research BIOSYS 1.0.15:

- flash: `1182072 / 1310720` bytes;
- RAM global: `59040 / 327680` bytes.

BIOSYS 1.0.16 debe informar medidas comparables. Sin nueva aprobación no puede
superar el baseline en más de:

- `12288` bytes de flash;
- `2048` bytes de RAM global.

No se aceptan asignaciones dinámicas en el pipeline PPG ni un aumento de la
frecuencia de renderizado o telemetría.

## 11. Flujo de entrega

1. Crear BIOSYS 1.0.16 desde 1.0.15 sin tocar los archivos MPU.
2. Incorporar replay y demostrar el fallo RED con el detector heredado.
3. Implementar detector por canal y sus pruebas sintéticas.
4. Implementar fusión rojo/IR y demostrar rechazo de canal único.
5. Implementar cuarentena óptica y por movimiento.
6. Implementar puerta de validez y ejecutar los cuatro datasets físicos.
7. Compilar modos normal, research y replay; medir memoria y hashes.
8. Documentar resultados antes de cargar firmware normal en el dispositivo.
9. Cargar research en el ESP32 y realizar una captura física controlada de
   90 segundos con dedo quieto.
10. Solo si esa captura alcanza `VALID` sin artefactos, producir el build normal
    instalable de BIOSYS 1.0.16.

## 12. Seguridad y fuentes técnicas

El MAX30102 permite controlar corriente LED, frecuencia de muestreo, ancho de
pulso y rango ADC, pero el fabricante advierte variación de corriente real entre
piezas. Por eso esta fase no interpreta una corriente mayor como garantía de
mejor calidad: [MAX30102 datasheet Rev. 1](https://www.analog.com/media/en/technical-documentation/data-sheets/max30102.pdf).

La separación entre señal utilizable y artefacto sigue el principio de evaluar
calidad antes de interpretar FC, descrito en investigación primaria sobre
índices de calidad PPG:
[Optimal Signal Quality Index for Photoplethysmogram Signals](https://pmc.ncbi.nlm.nih.gov/articles/PMC5597264/).

La cuarentena ante cambios abruptos se fundamenta en que los artefactos de
movimiento alteran fuertemente amplitud y línea base, y requieren detección
explícita antes de estimar FC:
[Novel tailoring algorithm for abrupt motion artifact removal in PPG](https://pmc.ncbi.nlm.nih.gov/articles/PMC6208512/).

Estas fuentes orientan el diseño, pero no convierten VitalWatch en dispositivo
médico validado. La exactitud deberá estudiarse posteriormente con referencia
externa y protocolo de sujetos.
